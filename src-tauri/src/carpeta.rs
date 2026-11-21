// Carpetas de los hormigueros: lectura del hormiguero abierto para la barra lateral (su árbol de
// subcarpetas y notas .md, .markdown, .txt, con las carpetas primero y luego por nombre) y
// creación de la carpeta de un hormiguero nuevo.

use serde::Serialize;
use std::fs;
use std::path::Path;

/// Extensiones de archivo que se consideran notas.
const EXTENSIONES_DE_NOTAS: [&str; 3] = ["md", "markdown", "txt"];
/// Carpetas que nunca se muestran (dependencias de proyectos), además de las ocultas (que empiezan con «.»).
const CARPETAS_IGNORADAS: [&str; 2] = ["node_modules", "target"];
/// Profundidad máxima del árbol, para no quedar recorriendo carpetas enormes sin fin.
const PROFUNDIDAD_MAXIMA_DEL_ARBOL: usize = 12;

/// Un elemento del árbol: una carpeta (con sus hijos) o una nota. Se manda a la interfaz con los
/// nombres en camelCase (`esCarpeta`), como `EntradaDelArbol` de `src/arbolDeCarpetas.ts`.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EntradaDelArbol {
    nombre: String,
    ruta: String,
    es_carpeta: bool,
    hijos: Vec<EntradaDelArbol>,
}

/// Lee recursivamente una carpeta. Las carpetas sin ninguna nota dentro se omiten para que el árbol
/// muestre solo lo útil. Los errores de lectura de una subcarpeta (permisos) se saltan en silencio.
fn leer_arbol(carpeta: &Path, profundidad: usize) -> Vec<EntradaDelArbol> {
    let Ok(contenido_de_la_carpeta) = fs::read_dir(carpeta) else { return Vec::new() };
    let mut entradas: Vec<EntradaDelArbol> = contenido_de_la_carpeta
        .filter_map(Result::ok)
        .filter_map(|elemento| {
            let nombre = elemento.file_name().to_string_lossy().into_owned();
            if nombre.starts_with('.') {
                return None;
            }
            let ruta = elemento.path();
            if ruta.is_dir() {
                if CARPETAS_IGNORADAS.contains(&nombre.as_str()) || profundidad >= PROFUNDIDAD_MAXIMA_DEL_ARBOL {
                    return None;
                }
                let hijos = leer_arbol(&ruta, profundidad + 1);
                if hijos.is_empty() {
                    return None;
                }
                Some(EntradaDelArbol { nombre, ruta: ruta.to_string_lossy().into_owned(), es_carpeta: true, hijos })
            } else {
                let extension = ruta.extension()?.to_str()?.to_lowercase();
                EXTENSIONES_DE_NOTAS.contains(&extension.as_str()).then(|| EntradaDelArbol {
                    nombre,
                    ruta: ruta.to_string_lossy().into_owned(),
                    es_carpeta: false,
                    hijos: Vec::new(),
                })
            }
        })
        .collect();
    // Carpetas primero; dentro de cada grupo, orden alfabético sin distinguir mayúsculas.
    entradas.sort_by(|una, otra| {
        otra.es_carpeta.cmp(&una.es_carpeta).then_with(|| una.nombre.to_lowercase().cmp(&otra.nombre.to_lowercase()))
    });
    entradas
}

/// Devuelve el árbol de notas de una carpeta. Corre en un hilo aparte (`en_segundo_plano`): un
/// hormiguero con miles de notas no traba la ventana mientras se lee.
#[tauri::command]
pub async fn leer_arbol_de_carpeta(ruta_de_la_carpeta: String) -> Result<Vec<EntradaDelArbol>, String> {
    crate::en_segundo_plano(move || {
        let carpeta = Path::new(&ruta_de_la_carpeta);
        if !carpeta.is_dir() {
            return Err(format!("The folder {ruta_de_la_carpeta} does not exist"));
        }
        Ok(leer_arbol(carpeta, 0))
    })
    .await
}

/// Crea la carpeta de un hormiguero nuevo, `nombre_del_hormiguero` dentro de
/// `carpeta_donde_crearla`, y devuelve su ruta. No usa una carpeta que ya exista (para eso está
/// «elegir una carpeta»), así nunca mezcla un hormiguero nuevo con lo que ya había ahí.
#[tauri::command]
pub fn crear_carpeta_de_hormiguero(carpeta_donde_crearla: String, nombre_del_hormiguero: String) -> Result<String, String> {
    let nombre = nombre_del_hormiguero.trim();
    if nombre.is_empty() || nombre == "." || nombre == ".." || nombre.contains(['/', '\\', ':']) {
        return Err(format!("“{nombre}” cannot be a folder name"));
    }
    let carpeta_padre = Path::new(&carpeta_donde_crearla);
    if !carpeta_padre.is_dir() {
        return Err(format!("The folder {} does not exist", carpeta_padre.display()));
    }
    let carpeta_del_hormiguero = carpeta_padre.join(nombre);
    if carpeta_del_hormiguero.exists() {
        return Err(format!("There is already a “{nombre}” folder in {}", carpeta_padre.display()));
    }
    fs::create_dir(&carpeta_del_hormiguero)
        .map_err(|error| format!("Could not create {}: {error}", carpeta_del_hormiguero.display()))?;
    Ok(carpeta_del_hormiguero.to_string_lossy().into_owned())
}

#[cfg(test)]
mod pruebas {
    use super::*;

    #[test]
    fn crea_el_hormiguero_sin_pisar_una_carpeta() {
        let carpeta_de_prueba = std::env::temp_dir().join(format!("ant-hormiguero-{}", std::process::id()));
        fs::create_dir_all(&carpeta_de_prueba).unwrap();
        let carpeta_padre = carpeta_de_prueba.to_string_lossy().into_owned();
        let carpeta_creada = crear_carpeta_de_hormiguero(carpeta_padre.clone(), " Novela ".into()).unwrap();
        assert!(Path::new(&carpeta_creada).is_dir());
        assert!(carpeta_creada.ends_with("Novela"));
        assert!(crear_carpeta_de_hormiguero(carpeta_padre.clone(), "Novela".into()).is_err());
        assert!(crear_carpeta_de_hormiguero(carpeta_padre.clone(), "a/b".into()).is_err());
        assert!(crear_carpeta_de_hormiguero(carpeta_padre, "  ".into()).is_err());
        fs::remove_dir_all(carpeta_de_prueba).unwrap();
    }

    #[test]
    fn manda_es_carpeta_en_camel_case() {
        let entrada = EntradaDelArbol { nombre: "a".into(), ruta: "/a".into(), es_carpeta: true, hijos: Vec::new() };
        assert!(serde_json::to_string(&entrada).unwrap().contains("\"esCarpeta\":true"));
    }
}
