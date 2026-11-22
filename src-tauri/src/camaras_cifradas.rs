// Cámaras cifradas: una cámara se puede cifrar con una contraseña (por ejemplo, para guardar
// contraseñas). Protege contra quien use el computador o acceda a la nube donde se sincroniza el
// hormiguero: cada archivo de la cámara (notas, imágenes…) queda cifrado en el disco.
//
// Cómo funciona (formato estándar «age», https://age-encryption.org, que se puede descifrar
// también fuera de Ant con la herramienta `age`):
//   · Cada cámara cifrada tiene su llave (una identidad X25519 de age), guardada dentro de la
//     misma cámara en `.ant-llave.age`, cifrada a su vez con la contraseña (scrypt). Así la llave
//     viaja con la cámara. Sin la contraseña no hay forma de recuperarla: se pierde todo.
//   · Cada archivo se guarda cifrado con esa llave, con `.age` al final: `Banco.md` → `Banco.md.age`.
//   · Para el resto de la app nada cambia de nombre: se sigue pidiendo `Banco.md`, y aquí se lee
//     y escribe `Banco.md.age` (`leer_archivo`, `escribir_archivo`). Así los fijados, la última
//     nota y los enlaces a imágenes siguen sirviendo al cifrar o descifrar.
//   · Desbloquear descifra la llave y la deja en memoria (`LlavesAbiertas`) hasta que se bloquea
//     la cámara o se cierra Ant. Nunca se escribe descifrada en el disco.
//   · Los nombres de las notas y carpetas siguen visibles en el disco; su contenido no.

use age::secrecy::{ExposeSecret, SecretString};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use tauri::Manager;

/// Archivo con la llave de la cámara (cifrada con la contraseña), en la carpeta de la cámara.
pub const ARCHIVO_DE_LA_LLAVE: &str = ".ant-llave.age";
/// Lo que se agrega al nombre de cada archivo cifrado.
const EXTENSION_CIFRADA: &str = ".age";
/// Largo mínimo de la contraseña.
const LARGO_MINIMO_DE_LA_CONTRASENA: usize = 8;

/// Errores que la interfaz reconoce por su código y muestra en el idioma elegido.
pub const ERROR_CAMARA_BLOQUEADA: &str = "camara-bloqueada";
pub const ERROR_CONTRASENA_INCORRECTA: &str = "contrasena-incorrecta";

/// Llaves de las cámaras desbloqueadas, por la carpeta de la cámara. Solo en memoria.
#[derive(Default, Clone)]
pub struct LlavesAbiertas(Arc<Mutex<HashMap<PathBuf, age::x25519::Identity>>>);

impl LlavesAbiertas {
    /// Llave de la cámara de `carpeta_de_la_camara`, si está desbloqueada.
    fn llave_de(&self, carpeta_de_la_camara: &Path) -> Option<age::x25519::Identity> {
        self.0.lock().ok()?.get(carpeta_de_la_camara).cloned()
    }
}

/// Las llaves abiertas de la app (se registran con `manage` al arrancar).
pub fn llaves_de(app: &tauri::AppHandle) -> LlavesAbiertas {
    app.state::<LlavesAbiertas>().inner().clone()
}

/// Carpeta de la cámara cifrada que contiene `ruta` (o que es `ruta`), si hay una: la primera
/// carpeta, subiendo, que tiene el archivo de la llave.
pub fn camara_cifrada_que_contiene(ruta: &Path) -> Option<PathBuf> {
    ruta.ancestors().find(|carpeta| carpeta.join(ARCHIVO_DE_LA_LLAVE).is_file()).map(Path::to_path_buf)
}

/// La ruta del archivo cifrado de `ruta` (`Banco.md` → `Banco.md.age`).
pub fn ruta_cifrada(ruta: &Path) -> PathBuf {
    let mut nombre = ruta.as_os_str().to_owned();
    nombre.push(EXTENSION_CIFRADA);
    PathBuf::from(nombre)
}

/// Si una ruta es de un archivo cifrado (termina en `.age`).
pub fn es_ruta_cifrada(ruta: &Path) -> bool {
    ruta.extension().is_some_and(|extension| extension == "age")
}

/// Si existe el archivo de `ruta`, tal cual o cifrado.
pub fn existe(ruta: &Path) -> bool {
    ruta.exists() || ruta_cifrada(ruta).exists()
}

/// Llave de la cámara cifrada que contiene `ruta`, o el error de cámara bloqueada.
fn llave_para(llaves: &LlavesAbiertas, carpeta_de_la_camara: &Path) -> Result<age::x25519::Identity, String> {
    llaves.llave_de(carpeta_de_la_camara).ok_or_else(|| ERROR_CAMARA_BLOQUEADA.to_string())
}

/// Lee un archivo: tal cual si existe así, o descifrando su `.age` si está en una cámara cifrada
/// (que tiene que estar desbloqueada).
pub fn leer_archivo(llaves: &LlavesAbiertas, ruta: &Path) -> Result<Vec<u8>, String> {
    let archivo_cifrado = ruta_cifrada(ruta);
    let camara = (!ruta.exists() && archivo_cifrado.exists()).then(|| camara_cifrada_que_contiene(ruta)).flatten();
    if let Some(camara) = camara {
        let llave = llave_para(llaves, &camara)?;
        let bytes_cifrados = fs::read(&archivo_cifrado).map_err(|error| format!("Could not read {}: {error}", ruta.display()))?;
        return age::decrypt(&llave, &bytes_cifrados).map_err(|error| format!("Could not decrypt {}: {error}", ruta.display()));
    }
    fs::read(ruta).map_err(|error| format!("Could not read {}: {error}", ruta.display()))
}

/// Escribe un archivo. En una cámara cifrada (desbloqueada) lo escribe cifrado en su `.age` y
/// borra la versión sin cifrar si quedaba una; fuera, tal cual. Siempre con `escribir_atomico`.
pub fn escribir_archivo(llaves: &LlavesAbiertas, ruta: &Path, bytes: &[u8]) -> Result<(), String> {
    let Some(camara) = camara_cifrada_que_contiene(ruta) else {
        return crate::escribir_atomico(ruta, bytes);
    };
    let llave = llave_para(llaves, &camara)?;
    let bytes_cifrados = age::encrypt(&llave.to_public(), bytes).map_err(|error| format!("Could not encrypt {}: {error}", ruta.display()))?;
    crate::escribir_atomico(&ruta_cifrada(ruta), &bytes_cifrados)?;
    if ruta.exists() {
        fs::remove_file(ruta).map_err(|error| format!("Could not remove {}: {error}", ruta.display()))?;
    }
    Ok(())
}

/// Archivos de la cámara que se cifran: todos los que no están ocultos (en subcarpetas también),
/// salvo `node_modules`. Los ocultos (`.ant-llave.age`, `.DS_Store`…) quedan como están.
fn archivos_de_la_camara(carpeta: &Path) -> Vec<PathBuf> {
    let mut archivos = Vec::new();
    let Ok(contenido) = fs::read_dir(carpeta) else { return archivos };
    for elemento in contenido.filter_map(Result::ok) {
        let nombre = elemento.file_name().to_string_lossy().into_owned();
        if nombre.starts_with('.') || nombre == "node_modules" {
            continue;
        }
        let ruta = elemento.path();
        if ruta.is_dir() {
            archivos.extend(archivos_de_la_camara(&ruta));
        } else if ruta.is_file() {
            archivos.push(ruta);
        }
    }
    archivos
}

/// Cifra los archivos de la cámara que todavía no lo están (uno por uno: cada uno se escribe
/// cifrado antes de borrar el original, así un corte nunca pierde nada).
fn cifrar_archivos_sin_cifrar(carpeta_de_la_camara: &Path, llave: &age::x25519::Identity) -> Result<(), String> {
    let destinatario = llave.to_public();
    for archivo in archivos_de_la_camara(carpeta_de_la_camara).into_iter().filter(|archivo| !es_ruta_cifrada(archivo)) {
        let Ok(bytes) = fs::read(&archivo) else { continue }; // Pudo guardarse cifrado mientras tanto.
        let bytes_cifrados = age::encrypt(&destinatario, &bytes).map_err(|error| format!("Could not encrypt {}: {error}", archivo.display()))?;
        crate::escribir_atomico(&ruta_cifrada(&archivo), &bytes_cifrados)?;
        fs::remove_file(&archivo).map_err(|error| format!("Could not remove {}: {error}", archivo.display()))?;
    }
    Ok(())
}

/// Destinatario de scrypt para cifrar la llave con la contraseña. En las pruebas se usa un factor
/// de trabajo bajo (en la app, el de age: cerca de un segundo, para que adivinar sea lento).
fn cifrador_con_contrasena(contrasena: &str) -> age::scrypt::Recipient {
    #[allow(unused_mut)]
    let mut destinatario = age::scrypt::Recipient::new(SecretString::from(contrasena.to_owned()));
    #[cfg(test)]
    destinatario.set_work_factor(4);
    destinatario
}

/// Lee la llave de la cámara con la contraseña, o el error de contraseña incorrecta.
fn abrir_la_llave(carpeta_de_la_camara: &Path, contrasena: &str) -> Result<age::x25519::Identity, String> {
    let llave_cifrada = fs::read(carpeta_de_la_camara.join(ARCHIVO_DE_LA_LLAVE)).map_err(|error| format!("Could not read the chamber key: {error}"))?;
    let llave_en_texto = age::decrypt(&age::scrypt::Identity::new(SecretString::from(contrasena.to_owned())), &llave_cifrada)
        .map_err(|_| ERROR_CONTRASENA_INCORRECTA.to_string())?;
    String::from_utf8(llave_en_texto)
        .ok()
        .and_then(|texto| texto.trim().parse::<age::x25519::Identity>().ok())
        .ok_or_else(|| "The chamber key is damaged".to_string())
}

/// Cifra una cámara con una contraseña: crea su llave (protegida con la contraseña), la deja
/// abierta y cifra todos sus archivos. La cámara queda desbloqueada.
fn cifrar(llaves: &LlavesAbiertas, carpeta_de_la_camara: &Path, contrasena: &str) -> Result<(), String> {
    if contrasena.chars().count() < LARGO_MINIMO_DE_LA_CONTRASENA {
        return Err(format!("The password needs at least {LARGO_MINIMO_DE_LA_CONTRASENA} characters"));
    }
    if !carpeta_de_la_camara.is_dir() {
        return Err(format!("The chamber {} does not exist", carpeta_de_la_camara.display()));
    }
    if camara_cifrada_que_contiene(carpeta_de_la_camara).is_some() {
        return Err("This chamber is already encrypted".into());
    }
    let llave = age::x25519::Identity::generate();
    let llave_cifrada = age::encrypt(&cifrador_con_contrasena(contrasena), llave.to_string().expose_secret().as_bytes())
        .map_err(|error| format!("Could not protect the key: {error}"))?;
    // Primero la llave (con ella todo lo que se cifre después se puede descifrar), luego los archivos.
    crate::escribir_atomico(&carpeta_de_la_camara.join(ARCHIVO_DE_LA_LLAVE), &llave_cifrada)?;
    llaves.0.lock().map_err(|_| "Key store unavailable")?.insert(carpeta_de_la_camara.to_path_buf(), llave.clone());
    cifrar_archivos_sin_cifrar(carpeta_de_la_camara, &llave)
}

/// Desbloquea una cámara con su contraseña. Si mientras estaba bloqueada se agregaron archivos sin
/// cifrar (desde el Finder, por ejemplo), los cifra.
fn desbloquear(llaves: &LlavesAbiertas, carpeta_de_la_camara: &Path, contrasena: &str) -> Result<(), String> {
    let llave = abrir_la_llave(carpeta_de_la_camara, contrasena)?;
    llaves.0.lock().map_err(|_| "Key store unavailable")?.insert(carpeta_de_la_camara.to_path_buf(), llave.clone());
    cifrar_archivos_sin_cifrar(carpeta_de_la_camara, &llave)
}

/// Quita el cifrado de una cámara (pide la contraseña): descifra todos sus archivos y borra su llave.
fn quitar_cifrado(llaves: &LlavesAbiertas, carpeta_de_la_camara: &Path, contrasena: &str) -> Result<(), String> {
    let llave = abrir_la_llave(carpeta_de_la_camara, contrasena)?;
    for archivo_cifrado in archivos_de_la_camara(carpeta_de_la_camara).into_iter().filter(|archivo| es_ruta_cifrada(archivo)) {
        let bytes_cifrados = fs::read(&archivo_cifrado).map_err(|error| format!("Could not read {}: {error}", archivo_cifrado.display()))?;
        let bytes = age::decrypt(&llave, &bytes_cifrados).map_err(|error| format!("Could not decrypt {}: {error}", archivo_cifrado.display()))?;
        crate::escribir_atomico(&archivo_cifrado.with_extension(""), &bytes)?;
        fs::remove_file(&archivo_cifrado).map_err(|error| format!("Could not remove {}: {error}", archivo_cifrado.display()))?;
    }
    fs::remove_file(carpeta_de_la_camara.join(ARCHIVO_DE_LA_LLAVE)).map_err(|error| format!("Could not remove the key: {error}"))?;
    llaves.0.lock().map_err(|_| "Key store unavailable")?.remove(carpeta_de_la_camara);
    Ok(())
}

/// Estado de cifrado de una cámara: `"sin_cifrar"`, `"bloqueada"` o `"desbloqueada"`.
#[tauri::command]
pub fn estado_de_cifrado(app: tauri::AppHandle, carpeta_de_la_camara: String) -> &'static str {
    let carpeta = Path::new(&carpeta_de_la_camara);
    if !carpeta.join(ARCHIVO_DE_LA_LLAVE).is_file() {
        "sin_cifrar"
    } else if llaves_de(&app).llave_de(carpeta).is_some() {
        "desbloqueada"
    } else {
        "bloqueada"
    }
}

/// Nombres de las cámaras cifradas del hormiguero (para marcarlas con un candado).
#[tauri::command]
pub fn camaras_cifradas(carpeta_del_hormiguero: String, camaras: Vec<String>) -> Vec<String> {
    camaras.into_iter().filter(|nombre| Path::new(&carpeta_del_hormiguero).join(nombre).join(ARCHIVO_DE_LA_LLAVE).is_file()).collect()
}

/// Cifra una cámara con una contraseña (ver `cifrar`), fuera del hilo principal.
#[tauri::command]
pub async fn cifrar_camara(app: tauri::AppHandle, carpeta_de_la_camara: String, contrasena: String) -> Result<(), String> {
    let llaves = llaves_de(&app);
    crate::en_segundo_plano(move || cifrar(&llaves, Path::new(&carpeta_de_la_camara), &contrasena)).await
}

/// Desbloquea una cámara cifrada (ver `desbloquear`), fuera del hilo principal.
#[tauri::command]
pub async fn desbloquear_camara(app: tauri::AppHandle, carpeta_de_la_camara: String, contrasena: String) -> Result<(), String> {
    let llaves = llaves_de(&app);
    crate::en_segundo_plano(move || desbloquear(&llaves, Path::new(&carpeta_de_la_camara), &contrasena)).await
}

/// Bloquea una cámara: olvida su llave hasta que se vuelva a desbloquear.
#[tauri::command]
pub fn bloquear_camara(app: tauri::AppHandle, carpeta_de_la_camara: String) {
    if let Ok(mut llaves) = llaves_de(&app).0.lock() {
        llaves.remove(Path::new(&carpeta_de_la_camara));
    }
}

/// Quita el cifrado de una cámara (ver `quitar_cifrado`), fuera del hilo principal.
#[tauri::command]
pub async fn quitar_cifrado_de_la_camara(app: tauri::AppHandle, carpeta_de_la_camara: String, contrasena: String) -> Result<(), String> {
    let llaves = llaves_de(&app);
    crate::en_segundo_plano(move || quitar_cifrado(&llaves, Path::new(&carpeta_de_la_camara), &contrasena)).await
}

/// Si una imagen está guardada cifrada (existe su `.age` y no la versión sin cifrar).
#[tauri::command]
pub fn es_imagen_cifrada(ruta: String) -> bool {
    let ruta = Path::new(&ruta);
    !ruta.exists() && ruta_cifrada(ruta).exists()
}

/// Devuelve los bytes descifrados de una imagen de una cámara cifrada (desbloqueada), para
/// mostrarla en la nota sin escribirla descifrada en el disco.
#[tauri::command]
pub async fn leer_imagen_cifrada(app: tauri::AppHandle, ruta: String) -> Result<tauri::ipc::Response, String> {
    let llaves = llaves_de(&app);
    crate::en_segundo_plano(move || leer_archivo(&llaves, Path::new(&ruta))).await.map(tauri::ipc::Response::new)
}

#[cfg(test)]
mod pruebas {
    use super::*;

    /// Una cámara de prueba con una nota, una imagen en una subcarpeta y un archivo oculto.
    fn camara_de_prueba(nombre: &str) -> PathBuf {
        let camara = std::env::temp_dir().join(format!("ant-cifrada-{nombre}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&camara);
        fs::create_dir_all(camara.join("Images")).unwrap();
        fs::write(camara.join("Banco.md"), "clave: 1234").unwrap();
        fs::write(camara.join("Images/tarjeta.png"), [137, 80, 78, 71]).unwrap();
        fs::write(camara.join(".DS_Store"), "").unwrap();
        camara
    }

    #[test]
    fn cifra_lee_escribe_y_quita_el_cifrado() {
        let llaves = LlavesAbiertas::default();
        let camara = camara_de_prueba("todo");
        assert!(cifrar(&llaves, &camara, "corta").is_err(), "contraseña muy corta");
        cifrar(&llaves, &camara, "una contraseña larga").unwrap();

        // En el disco solo quedan los cifrados (y lo oculto, tal cual).
        assert!(!camara.join("Banco.md").exists() && camara.join("Banco.md.age").exists());
        assert!(camara.join("Images/tarjeta.png.age").exists());
        assert!(camara.join(".DS_Store").exists() && !camara.join(".DS_Store.age").exists());
        assert!(!fs::read_to_string(camara.join("Banco.md.age")).unwrap_or_default().contains("1234"));

        // Para la app, la nota sigue llamándose Banco.md.
        assert_eq!(leer_archivo(&llaves, &camara.join("Banco.md")).unwrap(), b"clave: 1234");
        escribir_archivo(&llaves, &camara.join("Nueva.md"), b"secreto").unwrap();
        assert!(camara.join("Nueva.md.age").exists() && !camara.join("Nueva.md").exists());
        assert!(existe(&camara.join("Nueva.md")));

        // Bloqueada no se lee; con la contraseña equivocada no se desbloquea.
        llaves.0.lock().unwrap().clear();
        assert_eq!(leer_archivo(&llaves, &camara.join("Banco.md")).unwrap_err(), ERROR_CAMARA_BLOQUEADA);
        assert_eq!(escribir_archivo(&llaves, &camara.join("Banco.md"), b"x").unwrap_err(), ERROR_CAMARA_BLOQUEADA);
        assert_eq!(desbloquear(&llaves, &camara, "otra contraseña").unwrap_err(), ERROR_CONTRASENA_INCORRECTA);

        // Un archivo sin cifrar que llegó mientras estaba bloqueada se cifra al desbloquear.
        fs::write(camara.join("Desde el Finder.md"), "hola").unwrap();
        desbloquear(&llaves, &camara, "una contraseña larga").unwrap();
        assert!(camara.join("Desde el Finder.md.age").exists() && !camara.join("Desde el Finder.md").exists());
        assert_eq!(leer_archivo(&llaves, &camara.join("Nueva.md")).unwrap(), b"secreto");

        // Quitar el cifrado deja todo como antes.
        quitar_cifrado(&llaves, &camara, "una contraseña larga").unwrap();
        assert_eq!(fs::read_to_string(camara.join("Banco.md")).unwrap(), "clave: 1234");
        assert!(camara.join("Images/tarjeta.png").exists() && !camara.join(ARCHIVO_DE_LA_LLAVE).exists());
        fs::remove_dir_all(&camara).unwrap();
    }

    #[test]
    fn fuera_de_una_camara_cifrada_todo_queda_igual() {
        let llaves = LlavesAbiertas::default();
        let camara = camara_de_prueba("normal");
        escribir_archivo(&llaves, &camara.join("Libre.md"), b"texto").unwrap();
        assert_eq!(fs::read_to_string(camara.join("Libre.md")).unwrap(), "texto");
        assert!(camara_cifrada_que_contiene(&camara.join("Libre.md")).is_none());
        fs::remove_dir_all(&camara).unwrap();
    }
}
