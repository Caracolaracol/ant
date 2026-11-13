// Menú de la app (barra de menús de macOS) y la ventana de Ajustes que se abre desde él.
// Reemplaza el menú por defecto de Tauri: así los textos quedan en español y Cmd+W ya no
// cierra la ventana principal (antes se perdía una nota sin guardar sin aviso).

use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{AppHandle, Manager, Runtime, WebviewUrl, WebviewWindowBuilder};

/// Identificador del ítem «Ajustes…» del menú.
pub const ID_AJUSTES: &str = "ajustes";

/// Arma el menú: «Ant» (acerca de, ajustes, ocultar, salir), «Edición» y «Ventana».
/// El menú «Edición» es necesario en macOS para que copiar, pegar y deshacer funcionen.
pub fn crear<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<Menu<R>> {
    let ajustes = MenuItem::with_id(app, ID_AJUSTES, "Ajustes…", true, Some("CmdOrCtrl+,"))?;
    let sep = || PredefinedMenuItem::separator(app);

    let menu_app = Submenu::with_items(
        app,
        "Ant",
        true,
        &[
            &PredefinedMenuItem::about(app, Some("Acerca de Ant"), None)?,
            &sep()?,
            &ajustes,
            &sep()?,
            &PredefinedMenuItem::services(app, Some("Servicios"))?,
            &sep()?,
            &PredefinedMenuItem::hide(app, Some("Ocultar Ant"))?,
            &PredefinedMenuItem::hide_others(app, Some("Ocultar otros"))?,
            &PredefinedMenuItem::show_all(app, Some("Mostrar todo"))?,
            &sep()?,
            &PredefinedMenuItem::quit(app, Some("Salir de Ant"))?,
        ],
    )?;

    let menu_edicion = Submenu::with_items(
        app,
        "Edición",
        true,
        &[
            &PredefinedMenuItem::undo(app, Some("Deshacer"))?,
            &PredefinedMenuItem::redo(app, Some("Rehacer"))?,
            &sep()?,
            &PredefinedMenuItem::cut(app, Some("Cortar"))?,
            &PredefinedMenuItem::copy(app, Some("Copiar"))?,
            &PredefinedMenuItem::paste(app, Some("Pegar"))?,
            &PredefinedMenuItem::select_all(app, Some("Seleccionar todo"))?,
        ],
    )?;

    let menu_ventana = Submenu::with_items(
        app,
        "Ventana",
        true,
        &[
            &PredefinedMenuItem::minimize(app, Some("Minimizar"))?,
            &PredefinedMenuItem::maximize(app, Some("Zoom"))?,
            &sep()?,
            &PredefinedMenuItem::fullscreen(app, Some("Pantalla completa"))?,
        ],
    )?;

    Menu::with_items(app, &[&menu_app, &menu_edicion, &menu_ventana])
}

/// Abre la ventana de Ajustes, o la trae al frente si ya está abierta.
/// Carga la misma interfaz que la ventana principal con `#ajustes`, y `main.tsx` decide qué mostrar.
pub fn abrir_ajustes<R: Runtime>(app: &AppHandle<R>) {
    if let Some(ventana) = app.get_webview_window("ajustes") {
        let _ = ventana.set_focus();
        return;
    }
    let constructor = WebviewWindowBuilder::new(app, "ajustes", WebviewUrl::App("index.html#ajustes".into()))
        .title("Ajustes")
        .inner_size(640.0, 420.0)
        .min_inner_size(520.0, 320.0);
    // Igual que la principal: sin barra de título visible, con los botones flotando sobre el contenido.
    #[cfg(target_os = "macos")]
    let constructor = constructor.title_bar_style(tauri::TitleBarStyle::Overlay).hidden_title(true);
    if let Err(e) = constructor.build() {
        eprintln!("No se pudo abrir la ventana de Ajustes: {e}");
    }
}
