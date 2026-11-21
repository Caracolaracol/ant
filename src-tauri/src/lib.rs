// Núcleo nativo de la app: arma la aplicación Tauri, registra los plugins, el menú y los
// comandos que la interfaz (React) llama para leer y guardar notas, ajustes, el hormiguero
// y sus cámaras (carpetas), notas diarias y los archivos que genera «Compilar y exportar» (Word y PDF).

mod ajustes;
mod carpeta;
mod diario;
mod menu;

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;
use tauri::{Emitter, Manager};

/// Se pone en `true` cuando la interfaz ya guardó lo pendiente y la app puede salir.
static LA_APP_PUEDE_SALIR: AtomicBool = AtomicBool::new(false);

/// Cuánto espera la app a que la interfaz guarde lo pendiente antes de salir igual.
const ESPERA_MAXIMA_ANTES_DE_SALIR: Duration = Duration::from_secs(3);

/// Sale de la app. La interfaz lo llama después de guardar las notas con cambios, cuando Rust le
/// avisó con `antes-de-salir` (ver `run`).
#[tauri::command]
fn salir(app: tauri::AppHandle) {
    LA_APP_PUEDE_SALIR.store(true, Ordering::SeqCst);
    app.exit(0);
}

/// Corre un trabajo de disco en un hilo aparte y espera su resultado. Los comandos sin `async`
/// corren en el hilo principal, el mismo que dibuja la ventana: leer una nota enorme o un
/// hormiguero con miles de archivos la dejaría trabada mientras tanto.
pub(crate) async fn en_segundo_plano<Resultado: Send + 'static>(
    trabajo: impl FnOnce() -> Result<Resultado, String> + Send + 'static,
) -> Result<Resultado, String> {
    tauri::async_runtime::spawn_blocking(trabajo)
        .await
        .map_err(|error| format!("Background task failed: {error}"))?
}

/// Lee una nota y devuelve su contenido como texto UTF-8. Se llama desde la interfaz al abrir un
/// archivo (diálogo «Abrir» o clic en la barra lateral) y antes de cada guardado automático (para
/// no pisar cambios hechos fuera de Ant).
#[tauri::command]
async fn leer_nota_del_disco(ruta_del_archivo: String) -> Result<String, String> {
    en_segundo_plano(move || {
        fs::read_to_string(&ruta_del_archivo).map_err(|error| format!("Could not read {ruta_del_archivo}: {error}"))
    })
    .await
}

/// Guarda el texto de una nota, creando el archivo o reemplazándolo (con `escribir_atomico`: un
/// corte a mitad de escritura nunca deja la nota a medias).
#[tauri::command]
async fn guardar_nota_en_el_disco(ruta_del_archivo: String, texto_de_la_nota: String) -> Result<(), String> {
    en_segundo_plano(move || escribir_atomico(Path::new(&ruta_del_archivo), texto_de_la_nota.as_bytes())).await
}

/// Escribe en un archivo temporal junto al destino y luego lo renombra, para que un corte a
/// mitad de escritura nunca deje el archivo a medias. La usan las notas, los archivos de
/// «Compilar y exportar» y `ajustes.json`.
pub(crate) fn escribir_atomico(ruta_de_destino: &Path, bytes: &[u8]) -> Result<(), String> {
    let mut nombre_temporal = ruta_de_destino.as_os_str().to_owned();
    nombre_temporal.push(".tmp");
    let ruta_temporal = PathBuf::from(nombre_temporal);
    let destino = ruta_de_destino.display();
    fs::write(&ruta_temporal, bytes).map_err(|error| format!("Could not write {destino}: {error}"))?;
    fs::rename(&ruta_temporal, ruta_de_destino).map_err(|error| format!("Could not save {destino}: {error}"))
}

/// Deshace el `encodeURIComponent` con que la interfaz manda la ruta en un encabezado (los
/// encabezados solo admiten ASCII y las rutas pueden tener tildes o eñes).
fn decodificar_ruta_del_encabezado(ruta_codificada: &str) -> String {
    let bytes_codificados = ruta_codificada.as_bytes();
    let mut bytes_decodificados = Vec::with_capacity(bytes_codificados.len());
    let valor_hexadecimal = |caracter: u8| (caracter as char).to_digit(16);
    let mut posicion = 0;
    while posicion < bytes_codificados.len() {
        if bytes_codificados[posicion] == b'%' && posicion + 2 < bytes_codificados.len() {
            if let (Some(cifra_alta), Some(cifra_baja)) =
                (valor_hexadecimal(bytes_codificados[posicion + 1]), valor_hexadecimal(bytes_codificados[posicion + 2]))
            {
                bytes_decodificados.push((cifra_alta * 16 + cifra_baja) as u8);
                posicion += 3;
                continue;
            }
        }
        bytes_decodificados.push(bytes_codificados[posicion]);
        posicion += 1;
    }
    String::from_utf8_lossy(&bytes_decodificados).into_owned()
}

/// Guarda un archivo binario (el Word o el PDF de «Compilar y exportar»). Los bytes llegan
/// crudos en el cuerpo de la llamada, sin pasar por JSON, y la ruta en el encabezado `ruta`.
#[tauri::command]
fn guardar_archivo_binario(pedido: tauri::ipc::Request<'_>) -> Result<(), String> {
    let tauri::ipc::InvokeBody::Raw(bytes_del_archivo) = pedido.body() else {
        return Err("Expected binary data".into());
    };
    let ruta_del_archivo = pedido
        .headers()
        .get("ruta")
        .and_then(|valor| valor.to_str().ok())
        .map(decodificar_ruta_del_encabezado)
        .ok_or("Missing file path")?;
    escribir_atomico(Path::new(&ruta_del_archivo), bytes_del_archivo)
}

#[cfg(test)]
mod pruebas {
    #[test]
    fn decodifica_rutas_con_tildes() {
        assert_eq!(
            super::decodificar_ruta_del_encabezado("%2FUsers%2Fyo%2FBa%C3%BAl%2FLa%20colonia.pdf"),
            "/Users/yo/Baúl/La colonia.pdf"
        );
    }
}

/// Muestra un archivo en el Finder (o en el explorador de archivos en Windows y Linux).
#[tauri::command]
fn mostrar_archivo_en_su_carpeta(ruta_del_archivo: String) -> Result<(), String> {
    use std::process::Command;
    #[cfg(target_os = "macos")]
    let resultado = Command::new("open").arg("-R").arg(&ruta_del_archivo).spawn();
    #[cfg(target_os = "windows")]
    let resultado = Command::new("explorer").arg(format!("/select,{ruta_del_archivo}")).spawn();
    #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
    let resultado = Command::new("xdg-open")
        .arg(Path::new(&ruta_del_archivo).parent().unwrap_or(Path::new("/")))
        .spawn();
    resultado.map(|_| ()).map_err(|error| format!("Could not open the folder: {error}"))
}

/// Punto de entrada: inicia Tauri con el plugin de diálogos, el menú propio y los comandos.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        // El menú nace en el idioma guardado; `guardar_ajustes` lo rehace si después cambia.
        .menu(|app| menu::crear(app, &ajustes::leer_ajustes(app.clone()).idioma))
        // Ajustes, bienvenida, cámara nueva y compilar viven en la ventana principal: se la
        // trae al frente y se le avisa con el evento del ítem.
        .on_menu_event(|app, evento_del_menu| {
            if let Some((_, nombre_del_evento)) = menu::EVENTOS.iter().find(|(id_del_item, _)| evento_del_menu.id() == *id_del_item) {
                if let Some(ventana_principal) = app.get_webview_window("main") {
                    let _ = ventana_principal.set_focus();
                }
                let _ = app.emit_to("main", *nombre_del_evento, ());
            }
        })
        .invoke_handler(tauri::generate_handler![
            leer_nota_del_disco,
            guardar_nota_en_el_disco,
            guardar_archivo_binario,
            mostrar_archivo_en_su_carpeta,
            ajustes::leer_ajustes,
            ajustes::guardar_ajustes,
            carpeta::leer_arbol_de_carpeta,
            carpeta::crear_carpeta_nueva,
            carpeta::listar_camaras,
            salir,
            diario::abrir_o_crear_nota_del_dia
        ])
        .build(tauri::generate_context!())
        .expect("error al iniciar la aplicación")
        // Al pedir salir (Cmd+Q, el Dock) con la ventana principal abierta, no se sale enseguida:
        // se avisa a la interfaz para que guarde las notas con cambios y ella llama a `salir`.
        // Si no responde a tiempo, se sale igual.
        .run(|app, evento| {
            if let tauri::RunEvent::ExitRequested { api, .. } = evento {
                if LA_APP_PUEDE_SALIR.load(Ordering::SeqCst) || app.get_webview_window("main").is_none() {
                    return;
                }
                api.prevent_exit();
                let _ = app.emit_to("main", "antes-de-salir", ());
                let app_para_salir = app.clone();
                std::thread::spawn(move || {
                    std::thread::sleep(ESPERA_MAXIMA_ANTES_DE_SALIR);
                    LA_APP_PUEDE_SALIR.store(true, Ordering::SeqCst);
                    app_para_salir.exit(0);
                });
            }
        });
}
