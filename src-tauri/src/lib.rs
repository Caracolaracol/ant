// Núcleo nativo de la app: arma la aplicación Tauri, registra los plugins y expone los
// comandos que la interfaz (React) llama para leer y guardar notas en disco.

use std::fs;

/// Lee una nota desde `path` y devuelve su contenido como texto UTF-8.
/// Se llama desde la interfaz al abrir un archivo elegido en el diálogo «Abrir».
#[tauri::command]
fn read_note(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| format!("No se pudo leer {path}: {e}"))
}

/// Guarda `contents` en `path`, creando el archivo o reemplazándolo.
/// Escribe primero en un archivo temporal junto al destino y luego lo renombra, para que un
/// corte a mitad de escritura nunca deje la nota a medias.
#[tauri::command]
fn write_note(path: String, contents: String) -> Result<(), String> {
    let tmp = format!("{path}.tmp");
    fs::write(&tmp, contents).map_err(|e| format!("No se pudo escribir {path}: {e}"))?;
    fs::rename(&tmp, &path).map_err(|e| format!("No se pudo guardar {path}: {e}"))
}

/// Punto de entrada: inicia Tauri con el plugin de diálogos (abrir/guardar) y los comandos.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![read_note, write_note])
        .run(tauri::generate_context!())
        .expect("error al iniciar la aplicación");
}
