// Menú de la app (barra de menús de macOS) y la ventana de Ajustes que se abre desde él.
// Reemplaza el menú por defecto de Tauri: así los textos siguen el idioma elegido en Ajustes
// (inglés por defecto, o español) y Cmd+W ya no cierra la ventana principal (antes se perdía
// una nota sin guardar sin aviso).

use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{AppHandle, Manager, Runtime, WebviewUrl, WebviewWindowBuilder};

/// Identificador del ítem «Ajustes…» del menú.
pub const ID_AJUSTES: &str = "ajustes";
/// Identificador del ítem «Compilar y exportar…» del menú.
pub const ID_COMPILAR: &str = "compilar";

/// Elige el texto en inglés o en español según `idioma` (`"es"` o cualquier otro valor = inglés).
fn texto<'a>(idioma: &str, en: &'a str, es: &'a str) -> &'a str {
    if idioma == "es" {
        es
    } else {
        en
    }
}

/// Arma el menú en `idioma`: «Ant» (acerca de, ajustes, ocultar, salir), «File» (compilar y
/// exportar), «Edit» y «Window».
/// El menú de edición es necesario en macOS para que copiar, pegar y deshacer funcionen.
pub fn crear<R: Runtime>(app: &AppHandle<R>, idioma: &str) -> tauri::Result<Menu<R>> {
    let t = |en, es| Some(texto(idioma, en, es));
    let ajustes = MenuItem::with_id(app, ID_AJUSTES, texto(idioma, "Settings…", "Ajustes…"), true, Some("CmdOrCtrl+,"))?;
    let sep = || PredefinedMenuItem::separator(app);

    let menu_app = Submenu::with_items(
        app,
        "Ant",
        true,
        &[
            &PredefinedMenuItem::about(app, t("About Ant", "Acerca de Ant"), None)?,
            &sep()?,
            &ajustes,
            &sep()?,
            &PredefinedMenuItem::services(app, t("Services", "Servicios"))?,
            &sep()?,
            &PredefinedMenuItem::hide(app, t("Hide Ant", "Ocultar Ant"))?,
            &PredefinedMenuItem::hide_others(app, t("Hide Others", "Ocultar otros"))?,
            &PredefinedMenuItem::show_all(app, t("Show All", "Mostrar todo"))?,
            &sep()?,
            &PredefinedMenuItem::quit(app, t("Quit Ant", "Salir de Ant"))?,
        ],
    )?;

    // «Compilar y exportar…»: la ventana principal abre el diálogo al recibir `abrir-compilar`.
    let compilar = MenuItem::with_id(
        app,
        ID_COMPILAR,
        texto(idioma, "Compile and Export…", "Compilar y exportar…"),
        true,
        Some("CmdOrCtrl+Shift+E"),
    )?;
    let menu_archivo = Submenu::with_items(app, texto(idioma, "File", "Archivo"), true, &[&compilar])?;

    let menu_edicion = Submenu::with_items(
        app,
        texto(idioma, "Edit", "Edición"),
        true,
        &[
            &PredefinedMenuItem::undo(app, t("Undo", "Deshacer"))?,
            &PredefinedMenuItem::redo(app, t("Redo", "Rehacer"))?,
            &sep()?,
            &PredefinedMenuItem::cut(app, t("Cut", "Cortar"))?,
            &PredefinedMenuItem::copy(app, t("Copy", "Copiar"))?,
            &PredefinedMenuItem::paste(app, t("Paste", "Pegar"))?,
            &PredefinedMenuItem::select_all(app, t("Select All", "Seleccionar todo"))?,
        ],
    )?;

    let menu_ventana = Submenu::with_items(
        app,
        texto(idioma, "Window", "Ventana"),
        true,
        &[
            &PredefinedMenuItem::minimize(app, t("Minimize", "Minimizar"))?,
            &PredefinedMenuItem::maximize(app, t("Zoom", "Zoom"))?,
            &sep()?,
            &PredefinedMenuItem::fullscreen(app, t("Enter Full Screen", "Pantalla completa"))?,
        ],
    )?;

    Menu::with_items(app, &[&menu_app, &menu_archivo, &menu_edicion, &menu_ventana])
}

/// Rehace el menú de la app en `idioma` y traduce el título de la ventana de Ajustes si está
/// abierta. Se llama al guardar los ajustes con un idioma distinto.
pub fn cambiar_idioma<R: Runtime>(app: &AppHandle<R>, idioma: &str) {
    match crear(app, idioma) {
        Ok(menu) => {
            let _ = app.set_menu(menu);
        }
        Err(e) => eprintln!("Could not rebuild the menu: {e}"),
    }
    if let Some(ventana) = app.get_webview_window("ajustes") {
        let _ = ventana.set_title(texto(idioma, "Settings", "Ajustes"));
    }
}

/// Abre la ventana de Ajustes, o la trae al frente si ya está abierta.
/// Carga la misma interfaz que la ventana principal con `#ajustes`, y `main.tsx` decide qué mostrar.
pub fn abrir_ajustes<R: Runtime>(app: &AppHandle<R>, idioma: &str) {
    if let Some(ventana) = app.get_webview_window("ajustes") {
        let _ = ventana.set_focus();
        return;
    }
    let constructor = WebviewWindowBuilder::new(app, "ajustes", WebviewUrl::App("index.html#ajustes".into()))
        .title(texto(idioma, "Settings", "Ajustes"))
        .inner_size(680.0, 480.0)
        .min_inner_size(520.0, 320.0);
    // Igual que la principal: sin barra de título visible, con los botones flotando sobre el contenido.
    #[cfg(target_os = "macos")]
    let constructor = constructor.title_bar_style(tauri::TitleBarStyle::Overlay).hidden_title(true);
    if let Err(e) = constructor.build() {
        eprintln!("Could not open the Settings window: {e}");
    }
}
