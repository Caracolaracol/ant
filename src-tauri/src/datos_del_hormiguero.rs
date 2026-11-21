// Datos del hormiguero en su carpeta oculta `.ant/` (como `.obsidian/` en una bóveda): lo que es
// de las notas y no de este computador, así viaja con el hormiguero al moverlo, sincronizarlo
// (iCloud, Dropbox, git) o respaldarlo. Por ahora, un archivo por cámara en `.ant/camaras/`:
//
//   .ant/camaras/Novela.json      fijados, sus iconos y las opciones de «Compilar y exportar»
//   .ant/camaras/.entrada.json    lo mismo para la «Entrada» (las notas sueltas de la raíz)
//
// Las rutas de adentro son relativas a la cámara y con `/` (las convierte la interfaz, en
// `src/hormigueros/datosDeLaCamara.ts`), así sirven en otro computador o sistema. Lo que es de
// este computador (idioma, colores, ancho del panel, dónde está el hormiguero) sigue en
// `ajustes.json`. Más adelante aquí puede ir la protección de las cámaras con contraseña.

use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

use crate::carpeta::CAMARA_DE_ENTRADA;

/// Carpeta oculta de los datos, en la raíz del hormiguero.
pub const CARPETA_DE_LOS_DATOS: &str = ".ant";
/// Subcarpeta con un archivo por cámara.
const CARPETA_DE_LAS_CAMARAS: &str = "camaras";
/// Archivo de la «Entrada»: empieza con «.» porque ninguna cámara de verdad puede llamarse así.
const ARCHIVO_DE_LA_ENTRADA: &str = ".entrada.json";
/// Versión del formato de los archivos, por si más adelante cambia su forma.
const VERSION_DEL_FORMATO: u32 = 1;

/// Lo que se guarda de una cámara. Los campos que falten en el archivo quedan vacíos. Debe
/// coincidir con `DatosDeLaCamara` de `src/hormigueros/datosDeLaCamara.ts`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(default)]
pub struct DatosDeLaCamara {
    /// Versión del formato (`VERSION_DEL_FORMATO`).
    pub version: u32,
    /// Notas, carpetas y capítulos fijados, en orden: ruta relativa a la cámara, o
    /// `ruta#título` para un capítulo.
    pub fijados: Vec<String>,
    /// Icono elegido para cada fijado, por su clave en `fijados`.
    pub iconos_de_fijados: BTreeMap<String, String>,
    /// Opciones de «Compilar y exportar» por carpeta (relativa a la cámara; `.` es la cámara misma).
    /// Su forma la define la interfaz (`OpcionesDeCompilacion`).
    pub opciones_de_compilacion_por_carpeta: BTreeMap<String, serde_json::Value>,
}

impl Default for DatosDeLaCamara {
    fn default() -> Self {
        DatosDeLaCamara {
            version: VERSION_DEL_FORMATO,
            fijados: Vec::new(),
            iconos_de_fijados: BTreeMap::new(),
            opciones_de_compilacion_por_carpeta: BTreeMap::new(),
        }
    }
}

/// Ruta del archivo de datos de una cámara. Rechaza nombres que podrían salirse de `.ant/`.
fn archivo_de_la_camara(carpeta_del_hormiguero: &Path, nombre_de_la_camara: &str) -> Result<PathBuf, String> {
    let nombre_del_archivo = if nombre_de_la_camara == CAMARA_DE_ENTRADA {
        ARCHIVO_DE_LA_ENTRADA.to_string()
    } else if nombre_de_la_camara.is_empty() || nombre_de_la_camara.starts_with('.') || nombre_de_la_camara.contains(['/', '\\', ':']) {
        return Err(format!("“{nombre_de_la_camara}” is not a chamber"));
    } else {
        format!("{nombre_de_la_camara}.json")
    };
    Ok(carpeta_del_hormiguero.join(CARPETA_DE_LOS_DATOS).join(CARPETA_DE_LAS_CAMARAS).join(nombre_del_archivo))
}

/// Lee los datos de una cámara: `None` si todavía no tiene archivo. Si el archivo está dañado, lo
/// deja a un lado (`….ilegible.json`, para no perderlo ni pisarlo) y también devuelve `None`.
fn leer_datos(carpeta_del_hormiguero: &Path, nombre_de_la_camara: &str) -> Result<Option<DatosDeLaCamara>, String> {
    let archivo = archivo_de_la_camara(carpeta_del_hormiguero, nombre_de_la_camara)?;
    let texto = match fs::read_to_string(&archivo) {
        Ok(texto) => texto,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(format!("Could not read {}: {error}", archivo.display())),
    };
    match serde_json::from_str(&texto) {
        Ok(datos) => Ok(Some(datos)),
        Err(_) => {
            let _ = fs::rename(&archivo, archivo.with_extension("ilegible.json"));
            Ok(None)
        }
    }
}

/// Guarda los datos de una cámara (creando `.ant/camaras/` si falta), con `escribir_atomico`.
fn guardar_datos(carpeta_del_hormiguero: &Path, nombre_de_la_camara: &str, datos: &DatosDeLaCamara) -> Result<(), String> {
    if !carpeta_del_hormiguero.is_dir() {
        return Err(format!("The anthill {} does not exist", carpeta_del_hormiguero.display()));
    }
    let archivo = archivo_de_la_camara(carpeta_del_hormiguero, nombre_de_la_camara)?;
    if let Some(carpeta) = archivo.parent() {
        fs::create_dir_all(carpeta).map_err(|error| format!("Could not create {}: {error}", carpeta.display()))?;
    }
    let datos_con_version = DatosDeLaCamara { version: VERSION_DEL_FORMATO, ..datos.clone() };
    let texto = serde_json::to_string_pretty(&datos_con_version).map_err(|error| error.to_string())?;
    crate::escribir_atomico(&archivo, texto.as_bytes())
}

/// Devuelve los datos de una cámara (o `None` si todavía no tiene), fuera del hilo principal.
#[tauri::command]
pub async fn leer_datos_de_la_camara(carpeta_del_hormiguero: String, nombre_de_la_camara: String) -> Result<Option<DatosDeLaCamara>, String> {
    crate::en_segundo_plano(move || leer_datos(Path::new(&carpeta_del_hormiguero), &nombre_de_la_camara)).await
}

/// Guarda los datos de una cámara, fuera del hilo principal.
#[tauri::command]
pub async fn guardar_datos_de_la_camara(carpeta_del_hormiguero: String, nombre_de_la_camara: String, datos: DatosDeLaCamara) -> Result<(), String> {
    crate::en_segundo_plano(move || guardar_datos(Path::new(&carpeta_del_hormiguero), &nombre_de_la_camara, &datos)).await
}

#[cfg(test)]
mod pruebas {
    use super::*;

    #[test]
    fn guarda_y_lee_los_datos_de_cada_camara_en_la_carpeta_oculta() {
        let hormiguero = std::env::temp_dir().join(format!("ant-datos-{}", std::process::id()));
        fs::create_dir_all(&hormiguero).unwrap();
        assert_eq!(leer_datos(&hormiguero, "Novela").unwrap(), None, "sin archivo todavía");

        let datos = DatosDeLaCamara { fijados: vec!["Libro I/01.md#Inicio".into()], ..Default::default() };
        guardar_datos(&hormiguero, "Novela", &datos).unwrap();
        guardar_datos(&hormiguero, CAMARA_DE_ENTRADA, &DatosDeLaCamara::default()).unwrap();
        assert!(hormiguero.join(".ant/camaras/Novela.json").is_file());
        assert!(hormiguero.join(".ant/camaras/.entrada.json").is_file());
        assert_eq!(leer_datos(&hormiguero, "Novela").unwrap(), Some(datos));

        // Un archivo dañado se deja a un lado, sin perderlo, y la cámara empieza de cero.
        fs::write(hormiguero.join(".ant/camaras/Novela.json"), "{ esto no es JSON").unwrap();
        assert_eq!(leer_datos(&hormiguero, "Novela").unwrap(), None);
        assert!(hormiguero.join(".ant/camaras/Novela.ilegible.json").is_file());

        // Faltan campos: quedan vacíos.
        fs::write(hormiguero.join(".ant/camaras/Trabajo.json"), r#"{ "fijados": ["a.md"] }"#).unwrap();
        let datos_incompletos = leer_datos(&hormiguero, "Trabajo").unwrap().unwrap();
        assert_eq!(datos_incompletos.fijados, vec!["a.md"]);
        assert!(datos_incompletos.iconos_de_fijados.is_empty());

        fs::remove_dir_all(&hormiguero).unwrap();
    }

    #[test]
    fn no_acepta_nombres_que_se_salgan_de_la_carpeta() {
        let hormiguero = Path::new("/h");
        for nombre_raro in ["", "..", "../otra", "a/b", "a\\b", ".oculta"] {
            assert!(archivo_de_la_camara(hormiguero, nombre_raro).is_err(), "{nombre_raro}");
        }
        assert!(archivo_de_la_camara(hormiguero, "Mi novela").unwrap().ends_with(".ant/camaras/Mi novela.json"));
    }
}
