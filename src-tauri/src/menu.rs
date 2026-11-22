// Menú de la app (barra de menús de macOS). Reemplaza el menú por defecto de Tauri: así los
// textos siguen el idioma elegido en Ajustes (inglés por defecto, o español) y Cmd+W ya no
// cierra la ventana principal (antes se perdía una nota sin guardar sin aviso).
// Los ítems propios (Ajustes, bienvenida, cámara nueva, compilar) no hacen nada aquí: avisan
// a la ventana principal con un evento (`EVENTOS`) y la interfaz abre lo que corresponda.
// Sus atajos se pueden cambiar en Ajustes → Atajos (`Ajustes.atajos_de_teclado`, con los mismos
// ids y valores por defecto que `src/atajos.ts`).

use crate::ajustes::Ajustes;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{AppHandle, Runtime};

/// Identificador del ítem «Ajustes…» del menú.
pub const ID_AJUSTES: &str = "ajustes";
/// Identificador del ítem «Bienvenida…» del menú.
pub const ID_BIENVENIDA: &str = "bienvenida";
/// Identificador del ítem «Cámara nueva…» del menú.
pub const ID_CAMARA_NUEVA: &str = "camara-nueva";
/// Identificador del ítem «Compilar y exportar…» del menú.
pub const ID_COMPILAR: &str = "compilar";

/// Evento que se emite a la ventana principal por cada ítem propio del menú.
pub const EVENTOS: [(&str, &str); 4] = [
    (ID_AJUSTES, "abrir-ajustes"),
    (ID_BIENVENIDA, "abrir-bienvenida"),
    (ID_CAMARA_NUEVA, "nueva-camara"),
    (ID_COMPILAR, "abrir-compilar"),
];

/// Atajo por defecto de cada ítem del menú que tiene uno, por su id en `Ajustes.atajos_de_teclado`
/// (deben coincidir con `ACCIONES_CON_ATAJO` de `src/atajos.ts`).
const ATAJOS_POR_DEFECTO: [(&str, &str); 3] = [
    ("ajustes", "CmdOrCtrl+Comma"),
    ("camara_nueva", "CmdOrCtrl+Shift+KeyN"),
    ("compilar", "CmdOrCtrl+Shift+KeyE"),
];

/// Ítem propio del menú con su atajo: el que eligió el usuario o, si no eligió (o el suyo no se
/// entiende), el de por defecto.
fn item_con_atajo<R: Runtime>(app: &AppHandle<R>, ajustes: &Ajustes, id_del_item: &str, id_del_atajo: &str, texto_del_item: &str) -> tauri::Result<MenuItem<R>> {
    let por_defecto = ATAJOS_POR_DEFECTO.iter().find(|(id, _)| *id == id_del_atajo).map(|(_, atajo)| *atajo);
    let item_con_el_atajo_elegido = ajustes
        .atajos_de_teclado
        .get(id_del_atajo)
        .and_then(|elegido| MenuItem::with_id(app, id_del_item, texto_del_item, true, Some(elegido.as_str())).ok());
    match item_con_el_atajo_elegido {
        Some(item) => Ok(item),
        None => MenuItem::with_id(app, id_del_item, texto_del_item, true, por_defecto),
    }
}

/// Elige el texto en inglés o en español según `idioma` (`"es"` o cualquier otro valor = inglés).
fn texto<'a>(idioma: &str, en_ingles: &'a str, en_espanol: &'a str) -> &'a str {
    if idioma == "es" {
        en_espanol
    } else {
        en_ingles
    }
}

/// Arma el menú en el idioma de los ajustes y con sus atajos: «Ant» (acerca de, bienvenida, ajustes, ocultar, salir), «File»
/// (cámara nueva, compilar y exportar), «Edit» y «Window».
/// El menú de edición es necesario en macOS para que copiar, pegar y deshacer funcionen.
pub fn crear<R: Runtime>(app: &AppHandle<R>, ajustes: &Ajustes) -> tauri::Result<Menu<R>> {
    let idioma = ajustes.idioma.as_str();
    // Texto de un ítem predefinido en el idioma elegido (esos ítems lo piden como `Option`).
    let texto_del_item = |en_ingles, en_espanol| Some(texto(idioma, en_ingles, en_espanol));
    let ajustes_item = item_con_atajo(app, ajustes, ID_AJUSTES, "ajustes", texto(idioma, "Settings…", "Ajustes…"))?;
    let bienvenida = MenuItem::with_id(app, ID_BIENVENIDA, texto(idioma, "Welcome to Ant…", "Bienvenida a Ant…"), true, None::<&str>)?;
    let separador = || PredefinedMenuItem::separator(app);

    let menu_app = Submenu::with_items(
        app,
        "Ant",
        true,
        &[
            &PredefinedMenuItem::about(app, texto_del_item("About Ant", "Acerca de Ant"), None)?,
            &bienvenida,
            &separador()?,
            &ajustes_item,
            &separador()?,
            &PredefinedMenuItem::services(app, texto_del_item("Services", "Servicios"))?,
            &separador()?,
            &PredefinedMenuItem::hide(app, texto_del_item("Hide Ant", "Ocultar Ant"))?,
            &PredefinedMenuItem::hide_others(app, texto_del_item("Hide Others", "Ocultar otros"))?,
            &PredefinedMenuItem::show_all(app, texto_del_item("Show All", "Mostrar todo"))?,
            &separador()?,
            &PredefinedMenuItem::quit(app, texto_del_item("Quit Ant", "Salir de Ant"))?,
        ],
    )?;

    let camara_nueva = item_con_atajo(app, ajustes, ID_CAMARA_NUEVA, "camara_nueva", texto(idioma, "New Chamber…", "Cámara nueva…"))?;
    let compilar = item_con_atajo(app, ajustes, ID_COMPILAR, "compilar", texto(idioma, "Compile and Export…", "Compilar y exportar…"))?;
    let menu_archivo = Submenu::with_items(app, texto(idioma, "File", "Archivo"), true, &[&camara_nueva, &separador()?, &compilar])?;

    let menu_edicion = Submenu::with_items(
        app,
        texto(idioma, "Edit", "Edición"),
        true,
        &[
            &PredefinedMenuItem::undo(app, texto_del_item("Undo", "Deshacer"))?,
            &PredefinedMenuItem::redo(app, texto_del_item("Redo", "Rehacer"))?,
            &separador()?,
            &PredefinedMenuItem::cut(app, texto_del_item("Cut", "Cortar"))?,
            &PredefinedMenuItem::copy(app, texto_del_item("Copy", "Copiar"))?,
            &PredefinedMenuItem::paste(app, texto_del_item("Paste", "Pegar"))?,
            &PredefinedMenuItem::select_all(app, texto_del_item("Select All", "Seleccionar todo"))?,
        ],
    )?;

    let menu_ventana = Submenu::with_items(
        app,
        texto(idioma, "Window", "Ventana"),
        true,
        &[
            &PredefinedMenuItem::minimize(app, texto_del_item("Minimize", "Minimizar"))?,
            &PredefinedMenuItem::maximize(app, texto_del_item("Zoom", "Zoom"))?,
            &separador()?,
            &PredefinedMenuItem::fullscreen(app, texto_del_item("Enter Full Screen", "Pantalla completa"))?,
        ],
    )?;

    Menu::with_items(app, &[&menu_app, &menu_archivo, &menu_edicion, &menu_ventana])
}

/// Rehace el menú de la app con los ajustes. Se llama al guardarlos con otro idioma u otros atajos.
pub fn rehacer<R: Runtime>(app: &AppHandle<R>, ajustes: &Ajustes) {
    match crear(app, ajustes) {
        Ok(menu_nuevo) => {
            let _ = app.set_menu(menu_nuevo);
        }
        Err(error) => eprintln!("Could not rebuild the menu: {error}"),
    }
}

#[cfg(test)]
mod pruebas {
    use super::*;

    /// Los atajos por defecto del menú tienen que ser los mismos que muestra Ajustes → Atajos.
    #[test]
    fn los_atajos_por_defecto_coinciden_con_los_de_la_interfaz() {
        let atajos_de_la_interfaz = include_str!("../../src/atajos.ts");
        for (id, atajo) in ATAJOS_POR_DEFECTO {
            let linea_esperada = format!("{{ id: \"{id}\", porDefecto: \"{atajo}\", esDelMenu: true }}");
            assert!(atajos_de_la_interfaz.contains(&linea_esperada), "falta en src/atajos.ts: {linea_esperada}");
        }
    }
}
