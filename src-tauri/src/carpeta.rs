// Lectura de la carpeta de trabajo para la barra lateral: devuelve su árbol de subcarpetas y
// notas (.md, .markdown, .txt), ordenado con las carpetas primero y luego por nombre.

use serde::Serialize;
use std::fs;
use std::path::Path;

/// Extensiones de archivo que se consideran notas.
const EXTENSIONES: [&str; 3] = ["md", "markdown", "txt"];
/// Carpetas que nunca se muestran (dependencias de proyectos), además de las ocultas (que empiezan con «.»).
const IGNORADAS: [&str; 2] = ["node_modules", "target"];
/// Profundidad máxima del árbol, para no quedar recorriendo carpetas enormes sin fin.
const PROFUNDIDAD_MAX: usize = 12;

/// Un elemento del árbol: una carpeta (con sus hijos) o una nota.
#[derive(Serialize)]
pub struct Entrada {
    nombre: String,
    ruta: String,
    es_carpeta: bool,
    hijos: Vec<Entrada>,
}

/// Lee recursivamente `dir`. Las carpetas sin ninguna nota dentro se omiten para que el árbol
/// muestre solo lo útil. Los errores de lectura de una subcarpeta (permisos) se saltan en silencio.
fn leer(dir: &Path, profundidad: usize) -> Vec<Entrada> {
    let Ok(lectura) = fs::read_dir(dir) else { return Vec::new() };
    let mut entradas: Vec<Entrada> = lectura
        .filter_map(Result::ok)
        .filter_map(|e| {
            let nombre = e.file_name().to_string_lossy().into_owned();
            if nombre.starts_with('.') {
                return None;
            }
            let ruta = e.path();
            if ruta.is_dir() {
                if IGNORADAS.contains(&nombre.as_str()) || profundidad >= PROFUNDIDAD_MAX {
                    return None;
                }
                let hijos = leer(&ruta, profundidad + 1);
                if hijos.is_empty() {
                    return None;
                }
                Some(Entrada { nombre, ruta: ruta.to_string_lossy().into_owned(), es_carpeta: true, hijos })
            } else {
                let ext = ruta.extension()?.to_str()?.to_lowercase();
                EXTENSIONES.contains(&ext.as_str()).then(|| Entrada {
                    nombre,
                    ruta: ruta.to_string_lossy().into_owned(),
                    es_carpeta: false,
                    hijos: Vec::new(),
                })
            }
        })
        .collect();
    // Carpetas primero; dentro de cada grupo, orden alfabético sin distinguir mayúsculas.
    entradas.sort_by(|a, b| b.es_carpeta.cmp(&a.es_carpeta).then_with(|| a.nombre.to_lowercase().cmp(&b.nombre.to_lowercase())));
    entradas
}

/// Devuelve el árbol de notas de la carpeta `path`.
#[tauri::command]
pub fn listar_carpeta(path: String) -> Result<Vec<Entrada>, String> {
    let dir = Path::new(&path);
    if !dir.is_dir() {
        return Err(format!("La carpeta {path} no existe"));
    }
    Ok(leer(dir, 0))
}
