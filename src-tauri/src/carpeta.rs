// Carpetas de los hormigueros: lectura del hormiguero abierto para la barra lateral (su árbol de
// subcarpetas y notas .md, .markdown, .txt, con las carpetas primero y luego por nombre) y
// creación de la carpeta de un hormiguero nuevo.

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
        return Err(format!("The folder {path} does not exist"));
    }
    Ok(leer(dir, 0))
}

/// Crea la carpeta de un hormiguero nuevo, `nombre` dentro de `padre`, y devuelve su ruta. No
/// usa una carpeta que ya exista (para eso está «elegir una carpeta»), así nunca mezcla un
/// hormiguero nuevo con lo que ya había ahí.
#[tauri::command]
pub fn crear_hormiguero(padre: String, nombre: String) -> Result<String, String> {
    let nombre = nombre.trim();
    if nombre.is_empty() || nombre == "." || nombre == ".." || nombre.contains(['/', '\\', ':']) {
        return Err(format!("“{nombre}” cannot be a folder name"));
    }
    let padre = Path::new(&padre);
    if !padre.is_dir() {
        return Err(format!("The folder {} does not exist", padre.display()));
    }
    let ruta = padre.join(nombre);
    if ruta.exists() {
        return Err(format!("There is already a “{nombre}” folder in {}", padre.display()));
    }
    fs::create_dir(&ruta).map_err(|e| format!("Could not create {}: {e}", ruta.display()))?;
    Ok(ruta.to_string_lossy().into_owned())
}

#[cfg(test)]
mod pruebas {
    use super::*;

    #[test]
    fn crea_el_hormiguero_sin_pisar_una_carpeta() {
        let base = std::env::temp_dir().join(format!("ant-hormiguero-{}", std::process::id()));
        fs::create_dir_all(&base).unwrap();
        let padre = base.to_string_lossy().into_owned();
        let ruta = crear_hormiguero(padre.clone(), " Novela ".into()).unwrap();
        assert!(Path::new(&ruta).is_dir());
        assert!(ruta.ends_with("Novela"));
        assert!(crear_hormiguero(padre.clone(), "Novela".into()).is_err());
        assert!(crear_hormiguero(padre.clone(), "a/b".into()).is_err());
        assert!(crear_hormiguero(padre, "  ".into()).is_err());
        fs::remove_dir_all(base).unwrap();
    }
}
