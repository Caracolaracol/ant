// Menú de la app (barra de menús de macOS). Reemplaza el menú por defecto de Tauri: así los
// textos siguen el idioma elegido en Ajustes (inglés por defecto, o español) y Cmd+W ya no
// cierra la ventana principal (antes se perdía una nota sin guardar sin aviso).
// Los ítems propios (Ajustes, bienvenida, hormiguero nuevo, compilar) no hacen nada aquí: avisan
// a la ventana principal con un evento (`EVENTOS`) y la interfaz abre lo que corresponda.

use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{AppHandle, Runtime};

/// Identificador del ítem «Ajustes…» del menú.
pub const ID_AJUSTES: &str = "ajustes";
/// Identificador del ítem «Bienvenida…» del menú.
pub const ID_BIENVENIDA: &str = "bienvenida";
/// Identificador del ítem «Hormiguero nuevo…» del menú.
pub const ID_HORMIGUERO: &str = "hormiguero";
/// Identificador del ítem «Compilar y exportar…» del menú.
pub const ID_COMPILAR: &str = "compilar";

/// Evento que se emite a la ventana principal por cada ítem propio del menú.
pub const EVENTOS: [(&str, &str); 4] = [
    (ID_AJUSTES, "abrir-ajustes"),
    (ID_BIENVENIDA, "abrir-bienvenida"),
    (ID_HORMIGUERO, "nuevo-hormiguero"),
    (ID_COMPILAR, "abrir-compilar"),
];

/// Elige el texto en inglés o en español según `idioma` (`"es"` o cualquier otro valor = inglés).
fn texto<'a>(idioma: &str, en: &'a str, es: &'a str) -> &'a str {
    if idioma == "es" {
        es
    } else {
        en
    }
}

/// Arma el menú en `idioma`: «Ant» (acerca de, bienvenida, ajustes, ocultar, salir), «File»
/// (hormiguero nuevo, compilar y exportar), «Edit» y «Window».
/// El menú de edición es necesario en macOS para que copiar, pegar y deshacer funcionen.
pub fn crear<R: Runtime>(app: &AppHandle<R>, idioma: &str) -> tauri::Result<Menu<R>> {
    let t = |en, es| Some(texto(idioma, en, es));
    let ajustes = MenuItem::with_id(app, ID_AJUSTES, texto(idioma, "Settings…", "Ajustes…"), true, Some("CmdOrCtrl+,"))?;
    let bienvenida = MenuItem::with_id(app, ID_BIENVENIDA, texto(idioma, "Welcome to Ant…", "Bienvenida a Ant…"), true, None::<&str>)?;
    let sep = || PredefinedMenuItem::separator(app);

    let menu_app = Submenu::with_items(
        app,
        "Ant",
        true,
        &[
            &PredefinedMenuItem::about(app, t("About Ant", "Acerca de Ant"), None)?,
            &bienvenida,
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

    let hormiguero = MenuItem::with_id(
        app,
        ID_HORMIGUERO,
        texto(idioma, "New Anthill…", "Hormiguero nuevo…"),
        true,
        None::<&str>,
    )?;
    let compilar = MenuItem::with_id(
        app,
        ID_COMPILAR,
        texto(idioma, "Compile and Export…", "Compilar y exportar…"),
        true,
        Some("CmdOrCtrl+Shift+E"),
    )?;
    let menu_archivo = Submenu::with_items(app, texto(idioma, "File", "Archivo"), true, &[&hormiguero, &sep()?, &compilar])?;

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

/// Rehace el menú de la app en `idioma`. Se llama al guardar los ajustes con un idioma distinto.
pub fn cambiar_idioma<R: Runtime>(app: &AppHandle<R>, idioma: &str) {
    match crear(app, idioma) {
        Ok(menu) => {
            let _ = app.set_menu(menu);
        }
        Err(e) => eprintln!("Could not rebuild the menu: {e}"),
    }
}
