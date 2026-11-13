// Núcleo nativo de la app: arma la aplicación Tauri, registra los plugins, el menú y los
// comandos que la interfaz (React) llama para leer y guardar notas, ajustes y carpetas.

mod ajustes;
mod carpeta;
mod menu;

use std::fs;

/// Lee una nota desde `path` y devuelve su contenido como texto UTF-8.
/// Se llama desde la interfaz al abrir un archivo (diálogo «Abrir» o clic en la barra lateral).
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

/// Abre la ventana de Ajustes desde la interfaz (por ejemplo, desde la barra lateral vacía).
/// Es `async` porque Tauri recomienda crear ventanas fuera del hilo principal de los comandos.
#[tauri::command]
async fn abrir_ajustes(app: tauri::AppHandle) {
    menu::abrir_ajustes(&app);
}

/// Punto de entrada: inicia Tauri con el plugin de diálogos, el menú propio y los comandos.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .menu(menu::crear)
        .on_menu_event(|app, evento| {
            if evento.id() == menu::ID_AJUSTES {
                menu::abrir_ajustes(app);
            }
        })
        .invoke_handler(tauri::generate_handler![
            read_note,
            write_note,
            abrir_ajustes,
            ajustes::leer_ajustes,
            ajustes::guardar_ajustes,
            carpeta::listar_carpeta
        ])
        .run(tauri::generate_context!())
        .expect("error al iniciar la aplicación");
}
