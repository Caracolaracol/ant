// Imágenes en las notas. Una imagen que se arrastra a una nota (desde fuera del hormiguero) o se
// pega se guarda en la carpeta `Images/` junto a la nota, con un nombre que no pisa otro, y la
// nota la enlaza en Markdown con su ruta relativa (`![](Images/foto.png)`). Para mostrarlas, la
// ventana las lee con el protocolo de archivos de Tauri (`asset:`), que solo deja leer las
// carpetas permitidas aquí (`permitir_mostrar_imagenes_de`). También se buscan en el hormiguero
// las imágenes enlazadas como en Obsidian, solo con su nombre (`![[foto.png]]`). En una cámara
// cifrada la imagen se guarda cifrada (`Images/foto.png.age`) y el enlace no cambia; para
// mostrarla, la interfaz pide sus bytes descifrados (`camaras_cifradas::leer_imagen_cifrada`).

use std::fs;
use std::path::{Path, PathBuf};
use tauri::Manager;

/// Carpeta, junto a la nota, donde se guardan las imágenes que se agregan.
pub const CARPETA_DE_IMAGENES: &str = "Images";
/// Extensiones de archivo que se consideran imágenes.
pub const EXTENSIONES_DE_IMAGENES: [&str; 8] = ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "avif"];
/// Profundidad máxima al buscar una imagen por nombre en el hormiguero.
const PROFUNDIDAD_MAXIMA_DE_LA_BUSQUEDA: usize = 12;

/// Nombre de archivo seguro para un enlace de Markdown: sin espacios (pasan a `-`) ni caracteres
/// que rompen el enlace o el sistema de archivos. Conserva letras con tilde.
fn nombre_seguro(nombre: &str) -> String {
    let limpio: String = nombre
        .trim()
        .chars()
        .map(|caracter| if caracter.is_whitespace() { '-' } else { caracter })
        .filter(|caracter| !"()[]<>#%?*:\"|\\/".contains(*caracter))
        .collect();
    let sin_puntos_al_inicio = limpio.trim_start_matches('.');
    if sin_puntos_al_inicio.is_empty() { "imagen".into() } else { sin_puntos_al_inicio.to_string() }
}

/// Ruta libre para `nombre_del_archivo` dentro de `carpeta`: si ya existe uno igual (también
/// cifrado), le agrega `-2`, `-3`… antes de la extensión. Nunca pisa una imagen.
fn ruta_libre(carpeta: &Path, nombre_del_archivo: &str) -> PathBuf {
    let ruta_pedida = carpeta.join(nombre_del_archivo);
    if !crate::camaras_cifradas::existe(&ruta_pedida) {
        return ruta_pedida;
    }
    let nombre_base = Path::new(nombre_del_archivo).file_stem().map(|base| base.to_string_lossy().into_owned()).unwrap_or_default();
    let extension = Path::new(nombre_del_archivo).extension().map(|extension| format!(".{}", extension.to_string_lossy())).unwrap_or_default();
    (2..)
        .map(|numero| carpeta.join(format!("{nombre_base}-{numero}{extension}")))
        .find(|ruta| !crate::camaras_cifradas::existe(ruta))
        .expect("siempre hay un número libre")
}

/// Crea `Images/` junto a la nota si falta y devuelve la ruta libre para la imagen y el enlace
/// relativo que va en la nota (`Images/foto.png`, siempre con `/`).
fn preparar_destino(carpeta_de_la_nota: &Path, nombre_de_la_imagen: &str) -> Result<(PathBuf, String), String> {
    if !carpeta_de_la_nota.is_dir() {
        return Err(format!("The folder {} does not exist", carpeta_de_la_nota.display()));
    }
    let carpeta_de_imagenes = carpeta_de_la_nota.join(CARPETA_DE_IMAGENES);
    fs::create_dir_all(&carpeta_de_imagenes).map_err(|error| format!("Could not create {}: {error}", carpeta_de_imagenes.display()))?;
    let ruta_de_destino = ruta_libre(&carpeta_de_imagenes, &nombre_seguro(nombre_de_la_imagen));
    let nombre_final = ruta_de_destino.file_name().unwrap_or_default().to_string_lossy().into_owned();
    Ok((ruta_de_destino, format!("{CARPETA_DE_IMAGENES}/{nombre_final}")))
}

/// Si la ruta tiene extensión de imagen.
fn es_imagen(ruta: &Path) -> bool {
    ruta.extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| EXTENSIONES_DE_IMAGENES.contains(&extension.to_lowercase().as_str()))
}

/// Copia una imagen (arrastrada desde fuera del hormiguero) a `Images/` junto a la nota y devuelve
/// el enlace relativo para la nota.
#[tauri::command]
pub async fn copiar_imagen_junto_a_la_nota(app: tauri::AppHandle, ruta_de_la_imagen: String, carpeta_de_la_nota: String) -> Result<String, String> {
    let llaves = crate::camaras_cifradas::llaves_de(&app);
    crate::en_segundo_plano(move || {
        let imagen = Path::new(&ruta_de_la_imagen);
        if !es_imagen(imagen) || !imagen.is_file() {
            return Err(format!("{ruta_de_la_imagen} is not an image"));
        }
        let nombre = imagen.file_name().unwrap_or_default().to_string_lossy().into_owned();
        let (ruta_de_destino, enlace) = preparar_destino(Path::new(&carpeta_de_la_nota), &nombre)?;
        let bytes_de_la_imagen = fs::read(imagen).map_err(|error| format!("Could not read {ruta_de_la_imagen}: {error}"))?;
        crate::camaras_cifradas::escribir_archivo(&llaves, &ruta_de_destino, &bytes_de_la_imagen)?;
        Ok(enlace)
    })
    .await
}

/// Guarda una imagen pegada (los bytes llegan crudos en el cuerpo; la carpeta de la nota y el
/// nombre, en los encabezados `carpeta` y `nombre`) en `Images/` junto a la nota, y devuelve el
/// enlace relativo para la nota.
#[tauri::command]
pub fn guardar_imagen_pegada(app: tauri::AppHandle, pedido: tauri::ipc::Request<'_>) -> Result<String, String> {
    let tauri::ipc::InvokeBody::Raw(bytes_de_la_imagen) = pedido.body() else {
        return Err("Expected binary data".into());
    };
    let encabezado = |nombre: &str| {
        pedido.headers().get(nombre).and_then(|valor| valor.to_str().ok()).map(crate::decodificar_ruta_del_encabezado)
    };
    let carpeta_de_la_nota = encabezado("carpeta").ok_or("Missing note folder")?;
    let nombre = encabezado("nombre").ok_or("Missing image name")?;
    let (ruta_de_destino, enlace) = preparar_destino(Path::new(&carpeta_de_la_nota), &nombre)?;
    crate::camaras_cifradas::escribir_archivo(&crate::camaras_cifradas::llaves_de(&app), &ruta_de_destino, bytes_de_la_imagen)?;
    Ok(enlace)
}

/// Deja que la ventana muestre las imágenes de una carpeta (sin sus subcarpetas) con el protocolo
/// `asset:`. Se pide para la carpeta de cada imagen antes de mostrarla.
#[tauri::command]
pub fn permitir_mostrar_imagenes_de(app: tauri::AppHandle, carpeta: String) -> Result<(), String> {
    app.asset_protocol_scope().allow_directory(&carpeta, false).map_err(|error| error.to_string())
}

/// Busca recursivamente un archivo llamado `nombre` (sin distinguir mayúsculas), saltándose lo oculto.
fn buscar_por_nombre(carpeta: &Path, nombre: &str, profundidad: usize) -> Option<PathBuf> {
    let mut subcarpetas = Vec::new();
    for elemento in fs::read_dir(carpeta).ok()?.filter_map(Result::ok) {
        let nombre_del_elemento = elemento.file_name().to_string_lossy().into_owned();
        if nombre_del_elemento.starts_with('.') || nombre_del_elemento == "node_modules" {
            continue;
        }
        let ruta = elemento.path();
        if ruta.is_dir() {
            subcarpetas.push(ruta);
        } else if nombre_del_elemento.eq_ignore_ascii_case(nombre) {
            return Some(ruta);
        }
    }
    if profundidad >= PROFUNDIDAD_MAXIMA_DE_LA_BUSQUEDA {
        return None;
    }
    subcarpetas.iter().find_map(|subcarpeta| buscar_por_nombre(subcarpeta, nombre, profundidad + 1))
}

/// Encuentra una imagen enlazada como en Obsidian, solo con su nombre o una ruta parcial
/// (`![[foto.png]]`): primero junto a la nota, después desde la raíz del hormiguero y, si no, en
/// cualquier carpeta del hormiguero. Devuelve su ruta completa, o `None`.
#[tauri::command]
pub async fn buscar_imagen_en_el_hormiguero(nombre: String, carpeta_de_la_nota: String, hormiguero: Option<String>) -> Result<Option<String>, String> {
    crate::en_segundo_plano(move || {
        let candidatas = [Some(PathBuf::from(&carpeta_de_la_nota).join(&nombre)), hormiguero.as_ref().map(|raiz| Path::new(raiz).join(&nombre))];
        if let Some(encontrada) = candidatas.into_iter().flatten().find(|ruta| ruta.is_file()) {
            return Ok(Some(encontrada.to_string_lossy().into_owned()));
        }
        let solo_el_nombre = Path::new(&nombre).file_name().map(|nombre| nombre.to_string_lossy().into_owned()).unwrap_or_default();
        Ok(hormiguero
            .and_then(|raiz| buscar_por_nombre(Path::new(&raiz), &solo_el_nombre, 0))
            .map(|ruta| ruta.to_string_lossy().into_owned()))
    })
    .await
}

#[cfg(test)]
mod pruebas {
    use super::*;

    #[test]
    fn el_nombre_queda_seguro_para_un_enlace() {
        assert_eq!(nombre_seguro("Captura de pantalla (1).png"), "Captura-de-pantalla-1.png");
        assert_eq!(nombre_seguro("canción#2.jpg"), "canción2.jpg");
        assert_eq!(nombre_seguro("..oculta.png"), "oculta.png");
        assert_eq!(nombre_seguro("   "), "imagen");
    }

    #[test]
    fn guarda_en_images_sin_pisar_y_encuentra_por_nombre() {
        let hormiguero = std::env::temp_dir().join(format!("ant-imagenes-{}", std::process::id()));
        let carpeta_de_la_nota = hormiguero.join("Novela");
        fs::create_dir_all(&carpeta_de_la_nota).unwrap();
        let (primera, enlace) = preparar_destino(&carpeta_de_la_nota, "mapa del nido.png").unwrap();
        assert_eq!(enlace, "Images/mapa-del-nido.png");
        fs::write(&primera, "png").unwrap();
        let (_, segundo_enlace) = preparar_destino(&carpeta_de_la_nota, "mapa del nido.png").unwrap();
        assert_eq!(segundo_enlace, "Images/mapa-del-nido-2.png");

        assert_eq!(buscar_por_nombre(&hormiguero, "MAPA-del-nido.png", 0), Some(primera));
        assert_eq!(buscar_por_nombre(&hormiguero, "no-esta.png", 0), None);
        fs::remove_dir_all(&hormiguero).unwrap();
    }

    #[test]
    fn reconoce_las_imagenes_por_su_extension() {
        assert!(es_imagen(Path::new("/a/foto.JPG")));
        assert!(!es_imagen(Path::new("/a/nota.md")));
    }
}
