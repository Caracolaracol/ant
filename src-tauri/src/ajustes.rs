// Ajustes de la app (por ahora solo la carpeta de trabajo), guardados como JSON en la carpeta de
// configuración de la app (en macOS, ~/Library/Application Support/cl.agus.ant/ajustes.json).
// Cada vez que se guardan, se avisa a todas las ventanas con el evento `ajustes-cambiados`,
// así la ventana principal se entera de lo que se cambió en la de Ajustes.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Manager};

/// Nombre del evento que se emite a todas las ventanas al cambiar los ajustes.
pub const EVENTO_CAMBIO: &str = "ajustes-cambiados";

/// Preferencias del usuario. Los campos nuevos deben tener `#[serde(default)]` para que un
/// archivo de una versión anterior se siga leyendo.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Ajustes {
    /// Carpeta donde el usuario trabaja; la barra lateral muestra su contenido.
    #[serde(default)]
    pub carpeta: Option<String>,
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

/// Guarda los ajustes en disco y avisa a todas las ventanas.
#[tauri::command]
pub fn guardar_ajustes(app: AppHandle, ajustes: Ajustes) -> Result<(), String> {
    let ruta = ruta_archivo(&app)?;
    if let Some(dir) = ruta.parent() {
        fs::create_dir_all(dir).map_err(|e| format!("No se pudo crear {}: {e}", dir.display()))?;
    }
    let texto = serde_json::to_string_pretty(&ajustes).map_err(|e| e.to_string())?;
    fs::write(&ruta, texto).map_err(|e| format!("No se pudieron guardar los ajustes: {e}"))?;
    app.emit(EVENTO_CAMBIO, &ajustes).map_err(|e| e.to_string())
}
