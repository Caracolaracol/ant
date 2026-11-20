// Ajustes de la app (idioma, modo escritor, carpeta de trabajo, fijados y ancho de la barra lateral, modo diario y colores), guardados como JSON en la carpeta de
// configuración de la app (en macOS, ~/Library/Application Support/cl.agus.ant/ajustes.json).
// Cada vez que se guardan, se avisa a todas las ventanas con el evento `ajustes-cambiados`,
// así la ventana principal se entera de lo que se cambió en la de Ajustes. Si cambió el idioma,
// además se rehace el menú de la app en el idioma nuevo.

use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Manager};

/// Nombre del evento que se emite a todas las ventanas al cambiar los ajustes.
pub const EVENTO_CAMBIO: &str = "ajustes-cambiados";

/// Preferencias del usuario. Los campos nuevos deben tener `#[serde(default)]` para que un
/// archivo de una versión anterior se siga leyendo.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Ajustes {
    /// Carpeta donde el usuario trabaja; la barra lateral muestra su contenido.
    #[serde(default)]
    pub carpeta: Option<String>,
    /// Notas y carpetas fijadas arriba en la barra lateral (rutas completas, en el orden en que se fijaron).
    #[serde(default)]
    pub fijados: Vec<String>,
    /// Modo diario: muestra un calendario en la barra lateral y cada día abre su nota en `Daily/`.
    #[serde(default)]
    pub diario: bool,
    /// Colores del tema que el usuario cambió, por nombre de variable CSS sin `--` (por ejemplo
    /// `"acento": "#e5ea15"`). Las variables que no están aquí usan el color por defecto.
    #[serde(default)]
    pub colores: BTreeMap<String, String>,
    /// Ancho de la barra lateral en píxeles, si el usuario la ensanchó o achicó.
    #[serde(default)]
    pub ancho_barra: Option<f64>,
    /// Idioma de la interfaz: `"en"` (por defecto) o `"es"`.
    #[serde(default = "idioma_por_defecto")]
    pub idioma: String,
    /// Modo escritor del editor; activo por defecto (Ant es primero para escritores).
    #[serde(default = "verdadero")]
    pub escritor: bool,
    /// Opciones del modo escritor.
    #[serde(default)]
    pub opciones_escritor: OpcionesEscritor,
    /// Nombre del autor para las portadas al compilar y exportar.
    #[serde(default)]
    pub autor: String,
    /// Opciones de «Compilar y exportar» de cada carpeta (orden de los capítulos, formato,
    /// estilo…), por ruta de la carpeta. Su forma la define la interfaz (`ConfigCompilacion`).
    #[serde(default)]
    pub compilaciones: BTreeMap<String, serde_json::Value>,
}

/// Opciones del modo escritor (ver `src/editor/escritor.ts`). Los campos que falten en el archivo
/// toman el valor de `Default`: todo activado y comillas según el idioma.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct OpcionesEscritor {
    /// Comillas rectas → tipográficas.
    pub comillas: bool,
    /// `"auto"` (según el idioma), `"curvas"` (“ ”) o `"latinas"` (« »).
    pub estilo_comillas: String,
    /// `--` → raya.
    pub rayas: bool,
    /// `...` → puntos suspensivos.
    pub puntos: bool,
    /// `<<` `>>` → comillas latinas.
    pub angulares: bool,
    /// `->` `<-` → flechas.
    pub flechas: bool,
    /// Letra con serifa, más grande y en columna más angosta.
    pub letra_libro: bool,
    /// Corrector ortográfico del sistema.
    pub corrector: bool,
}

impl Default for OpcionesEscritor {
    fn default() -> Self {
        OpcionesEscritor {
            comillas: true,
            estilo_comillas: "auto".into(),
            rayas: true,
            puntos: true,
            angulares: true,
            flechas: true,
            letra_libro: true,
            corrector: true,
        }
    }
}

/// Para los campos que valen `true` si no están en el archivo.
fn verdadero() -> bool {
    true
}

/// Ant está en inglés salvo que el usuario elija otro idioma.
fn idioma_por_defecto() -> String {
    "en".into()
}

/// Valores de una instalación nueva (o de un archivo de ajustes ilegible).
impl Default for Ajustes {
    fn default() -> Self {
        Ajustes {
            carpeta: None,
            fijados: Vec::new(),
            diario: false,
            colores: BTreeMap::new(),
            ancho_barra: None,
            idioma: idioma_por_defecto(),
            escritor: true,
            opciones_escritor: OpcionesEscritor::default(),
            autor: String::new(),
            compilaciones: BTreeMap::new(),
        }
    }
}

/// Ruta del archivo de ajustes dentro de la carpeta de configuración de la app.
fn ruta_archivo(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    Ok(dir.join("ajustes.json"))
}

/// Lee los ajustes guardados. Si el archivo no existe o está dañado, devuelve los valores por defecto.
#[tauri::command]
pub fn leer_ajustes(app: AppHandle) -> Ajustes {
    ruta_archivo(&app)
        .ok()
        .and_then(|ruta| fs::read_to_string(ruta).ok())
        .and_then(|texto| serde_json::from_str(&texto).ok())
        .unwrap_or_default()
}

/// Guarda los ajustes en disco y avisa a todas las ventanas. Si cambió el idioma, traduce el
/// menú de la app y el título de la ventana de Ajustes.
#[tauri::command]
pub fn guardar_ajustes(app: AppHandle, ajustes: Ajustes) -> Result<(), String> {
    let idioma_anterior = leer_ajustes(app.clone()).idioma;
    let ruta = ruta_archivo(&app)?;
    if let Some(dir) = ruta.parent() {
        fs::create_dir_all(dir).map_err(|e| format!("Could not create {}: {e}", dir.display()))?;
    }
    let texto = serde_json::to_string_pretty(&ajustes).map_err(|e| e.to_string())?;
    fs::write(&ruta, texto).map_err(|e| format!("Could not save the settings: {e}"))?;
    if ajustes.idioma != idioma_anterior {
        crate::menu::cambiar_idioma(&app, &ajustes.idioma);
    }
    app.emit(EVENTO_CAMBIO, &ajustes).map_err(|e| e.to_string())
}
