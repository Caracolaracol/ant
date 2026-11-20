// Núcleo nativo de la app: arma la aplicación Tauri, registra los plugins, el menú y los
// comandos que la interfaz (React) llama para leer y guardar notas, ajustes, carpetas, notas
// diarias y los archivos que genera «Compilar y exportar» (Word y PDF).

mod ajustes;
mod carpeta;
mod diario;
mod menu;

use std::fs;
use tauri::{Emitter, Manager};

/// Lee una nota desde `path` y devuelve su contenido como texto UTF-8.
/// Se llama desde la interfaz al abrir un archivo (diálogo «Abrir» o clic en la barra lateral).
#[tauri::command]
fn read_note(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| format!("Could not read {path}: {e}"))
}

/// Guarda `contents` en `path`, creando el archivo o reemplazándolo.
/// Escribe primero en un archivo temporal junto al destino y luego lo renombra, para que un
/// corte a mitad de escritura nunca deje la nota a medias.
#[tauri::command]
fn write_note(path: String, contents: String) -> Result<(), String> {
    escribir_atomico(&path, contents.as_bytes())
}

/// Escribe en un archivo temporal junto al destino y luego lo renombra, para que un corte a
/// mitad de escritura nunca deje el archivo a medias.
fn escribir_atomico(path: &str, datos: &[u8]) -> Result<(), String> {
    let tmp = format!("{path}.tmp");
    fs::write(&tmp, datos).map_err(|e| format!("Could not write {path}: {e}"))?;
    fs::rename(&tmp, path).map_err(|e| format!("Could not save {path}: {e}"))
}

/// Deshace el `encodeURIComponent` con que la interfaz manda la ruta en un encabezado (los
/// encabezados solo admiten ASCII y las rutas pueden tener tildes o eñes).
fn decodificar_ruta(texto: &str) -> String {
    let b = texto.as_bytes();
    let mut out = Vec::with_capacity(b.len());
    let hex = |c: u8| (c as char).to_digit(16);
    let mut i = 0;
    while i < b.len() {
        if b[i] == b'%' && i + 2 < b.len() {
            if let (Some(a), Some(c)) = (hex(b[i + 1]), hex(b[i + 2])) {
                out.push((a * 16 + c) as u8);
                i += 3;
                continue;
            }
        }
        out.push(b[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

/// Guarda un archivo binario (el Word o el PDF de «Compilar y exportar»). Los bytes llegan
/// crudos en el cuerpo de la llamada, sin pasar por JSON, y la ruta en el encabezado `ruta`.
#[tauri::command]
fn guardar_binario(request: tauri::ipc::Request<'_>) -> Result<(), String> {
    let tauri::ipc::InvokeBody::Raw(datos) = request.body() else {
        return Err("Expected binary data".into());
    };
    let ruta = request
        .headers()
        .get("ruta")
        .and_then(|v| v.to_str().ok())
        .map(decodificar_ruta)
        .ok_or("Missing file path")?;
    escribir_atomico(&ruta, datos)
}

#[cfg(test)]
mod pruebas {
    #[test]
    fn decodifica_rutas_con_tildes() {
        assert_eq!(super::decodificar_ruta("%2FUsers%2Fyo%2FBa%C3%BAl%2FLa%20colonia.pdf"), "/Users/yo/Baúl/La colonia.pdf");
    }
}

/// Muestra un archivo en el Finder (o en el explorador de archivos en Windows y Linux).
#[tauri::command]
fn mostrar_en_carpeta(ruta: String) -> Result<(), String> {
    use std::process::Command;
    #[cfg(target_os = "macos")]
    let r = Command::new("open").arg("-R").arg(&ruta).spawn();
    #[cfg(target_os = "windows")]
    let r = Command::new("explorer").arg(format!("/select,{ruta}")).spawn();
    #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
    let r = Command::new("xdg-open")
        .arg(std::path::Path::new(&ruta).parent().unwrap_or(std::path::Path::new("/")))
        .spawn();
    r.map(|_| ()).map_err(|e| format!("Could not open the folder: {e}"))
}

/// Abre la ventana de Ajustes desde la interfaz (por ejemplo, desde la barra lateral vacía).
/// Es `async` porque Tauri recomienda crear ventanas fuera del hilo principal de los comandos.
#[tauri::command]
async fn abrir_ajustes(app: tauri::AppHandle) {
    let idioma = ajustes::leer_ajustes(app.clone()).idioma;
    menu::abrir_ajustes(&app, &idioma);
}

/// Punto de entrada: inicia Tauri con el plugin de diálogos, el menú propio y los comandos.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        // El menú nace en el idioma guardado; `guardar_ajustes` lo rehace si después cambia.
        .menu(|app| menu::crear(app, &ajustes::leer_ajustes(app.clone()).idioma))
        .on_menu_event(|app, evento| {
            if evento.id() == menu::ID_AJUSTES {
                menu::abrir_ajustes(app, &ajustes::leer_ajustes(app.clone()).idioma);
            } else if evento.id() == menu::ID_COMPILAR {
                // El diálogo vive en la ventana principal: se la trae al frente y se le avisa.
                if let Some(ventana) = app.get_webview_window("main") {
                    let _ = ventana.set_focus();
                }
                let _ = app.emit_to("main", "abrir-compilar", ());
            }
        })
        .invoke_handler(tauri::generate_handler![
            read_note,
            write_note,
            guardar_binario,
            mostrar_en_carpeta,
            abrir_ajustes,
            ajustes::leer_ajustes,
            ajustes::guardar_ajustes,
            carpeta::listar_carpeta,
            diario::abrir_dia
        ])
        .run(tauri::generate_context!())
        .expect("error al iniciar la aplicación");
}
