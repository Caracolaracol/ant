// Modo diario: cada día del calendario de la barra lateral tiene su nota en la carpeta `Daily`
// dentro de la carpeta de trabajo, con la fecha como nombre (`Daily/2026-11-20.md`). Este módulo
// crea la carpeta y la nota la primera vez que se pide un día, y si ya existen no las toca. Si la
// carpeta de trabajo ya tiene una carpeta `Daily` (aunque esté escrita `daily` o `DAILY`), se usa esa.

use std::fs::{self, OpenOptions};
use std::io::{ErrorKind, Write};
use std::path::{Path, PathBuf};

/// Nombre de la carpeta de notas diarias, dentro de la carpeta de trabajo.
const CARPETA_DIARIO: &str = "Daily";

/// Busca la carpeta de notas diarias en `base`: la que ya exista con ese nombre, sin importar
/// mayúsculas, o si no hay ninguna, `base/Daily` (que se creará).
fn carpeta_diario(base: &Path) -> PathBuf {
    fs::read_dir(base)
        .ok()
        .and_then(|lectura| {
            lectura
                .filter_map(Result::ok)
                .find(|e| e.file_name().to_string_lossy().eq_ignore_ascii_case(CARPETA_DIARIO) && e.path().is_dir())
        })
        .map(|e| e.path())
        .unwrap_or_else(|| base.join(CARPETA_DIARIO))
}

/// Acepta solo fechas con forma `AAAA-MM-DD`, para que el nombre del archivo nunca pueda
/// salirse de la carpeta `Daily` (nada de `/` ni `..`).
fn fecha_valida(fecha: &str) -> bool {
    let b = fecha.as_bytes();
    b.len() == 10
        && b.iter().enumerate().all(|(i, c)| if i == 4 || i == 7 { *c == b'-' } else { c.is_ascii_digit() })
}

/// Devuelve la ruta de la nota del día `fecha` (`AAAA-MM-DD`) dentro de la carpeta `Daily` de
/// `carpeta` (ver `carpeta_diario`). Si esa carpeta no existe la crea, y si la nota no existe la crea con `contenido`
/// (el título con la fecha, que arma la interfaz). Una nota que ya existe no se modifica.
#[tauri::command]
pub fn abrir_dia(carpeta: String, fecha: String, contenido: String) -> Result<String, String> {
    if !fecha_valida(&fecha) {
        return Err(format!("Invalid date: {fecha}"));
    }
    let base = Path::new(&carpeta);
    if !base.is_dir() {
        return Err(format!("The folder {carpeta} does not exist"));
    }
    let dir = carpeta_diario(base);
    fs::create_dir_all(&dir).map_err(|e| format!("Could not create {}: {e}", dir.display()))?;
    let ruta = dir.join(format!("{fecha}.md"));
    // `create_new` falla si el archivo ya existe: así nunca se pisa una nota escrita.
    match OpenOptions::new().write(true).create_new(true).open(&ruta) {
        Ok(mut archivo) => archivo
            .write_all(contenido.as_bytes())
            .map_err(|e| format!("Could not write {}: {e}", ruta.display()))?,
        Err(e) if e.kind() == ErrorKind::AlreadyExists => {}
        Err(e) => return Err(format!("Could not create {}: {e}", ruta.display())),
    }
    Ok(ruta.to_string_lossy().into_owned())
}

/// Pruebas del modo diario: crea la carpeta y la nota, no pisa una nota existente y rechaza
/// fechas que podrían salirse de `Daily`.
#[cfg(test)]
mod pruebas {
    use super::*;

    /// Carpeta temporal vacía y única para cada prueba.
    fn carpeta_temporal(nombre: &str) -> String {
        let dir = std::env::temp_dir().join(format!("ant-diario-{nombre}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir.to_string_lossy().into_owned()
    }

    #[test]
    fn crea_carpeta_y_nota_y_no_la_pisa() {
        let base = carpeta_temporal("crear");
        let ruta = abrir_dia(base.clone(), "2026-11-20".into(), "# Hoy\n".into()).unwrap();
        assert!(ruta.ends_with("Daily/2026-11-20.md"));
        assert_eq!(fs::read_to_string(&ruta).unwrap(), "# Hoy\n");
        fs::write(&ruta, "escrito").unwrap();
        abrir_dia(base, "2026-11-20".into(), "# Otro\n".into()).unwrap();
        assert_eq!(fs::read_to_string(&ruta).unwrap(), "escrito");
    }

    #[test]
    fn usa_la_carpeta_daily_que_ya_existe() {
        let base = carpeta_temporal("existente");
        fs::create_dir_all(Path::new(&base).join("daily")).unwrap();
        let ruta = abrir_dia(base.clone(), "2026-11-21".into(), String::new()).unwrap();
        assert!(ruta.ends_with("daily/2026-11-21.md"), "{ruta}");
        assert_eq!(fs::read_dir(&base).unwrap().count(), 1);
    }

    #[test]
    fn rechaza_fechas_raras() {
        let base = carpeta_temporal("raras");
        for fecha in ["../../x.md", "2026-11-2", "2026/11/20", "aaaa-bb-cc"] {
            assert!(abrir_dia(base.clone(), fecha.into(), String::new()).is_err(), "{fecha}");
        }
    }
}
