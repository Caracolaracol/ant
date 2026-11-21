// Modo diario: cada día del calendario de la barra lateral tiene su nota en la carpeta `Daily`
// dentro del hormiguero abierto, con la fecha como nombre (`Daily/2026-11-20.md`). Este módulo
// crea la carpeta y la nota la primera vez que se pide un día, y si ya existen no las toca. Si el
// hormiguero ya tiene una carpeta `Daily` (aunque esté escrita `daily` o `DAILY`), se usa esa.

use std::fs::{self, OpenOptions};
use std::io::{ErrorKind, Write};
use std::path::{Path, PathBuf};

/// Nombre de la carpeta de notas diarias, dentro del hormiguero.
const NOMBRE_DE_LA_CARPETA_DEL_DIARIO: &str = "Daily";

/// Busca la carpeta de notas diarias del hormiguero: la que ya exista con ese nombre, sin
/// importar mayúsculas, o si no hay ninguna, `Daily` dentro del hormiguero (que se creará).
fn carpeta_del_diario(carpeta_del_hormiguero: &Path) -> PathBuf {
    fs::read_dir(carpeta_del_hormiguero)
        .ok()
        .and_then(|contenido_de_la_carpeta| {
            contenido_de_la_carpeta.filter_map(Result::ok).find(|entrada| {
                entrada.file_name().to_string_lossy().eq_ignore_ascii_case(NOMBRE_DE_LA_CARPETA_DEL_DIARIO) && entrada.path().is_dir()
            })
        })
        .map(|entrada| entrada.path())
        .unwrap_or_else(|| carpeta_del_hormiguero.join(NOMBRE_DE_LA_CARPETA_DEL_DIARIO))
}

/// Acepta solo fechas con forma `AAAA-MM-DD`, para que el nombre del archivo nunca pueda
/// salirse de la carpeta `Daily` (nada de `/` ni `..`).
fn es_una_clave_de_dia_valida(clave_del_dia: &str) -> bool {
    let caracteres = clave_del_dia.as_bytes();
    caracteres.len() == 10
        && caracteres.iter().enumerate().all(|(posicion, caracter)| {
            if posicion == 4 || posicion == 7 { *caracter == b'-' } else { caracter.is_ascii_digit() }
        })
}

/// Devuelve la ruta de la nota del día `clave_del_dia` (`AAAA-MM-DD`) dentro de la carpeta
/// `Daily` del hormiguero (ver `carpeta_del_diario`). Si esa carpeta no existe la crea, y si la
/// nota no existe la crea con `texto_inicial` (el título con la fecha, que arma la interfaz).
/// Una nota que ya existe no se modifica.
#[tauri::command]
pub fn abrir_o_crear_nota_del_dia(carpeta_del_hormiguero: String, clave_del_dia: String, texto_inicial: String) -> Result<String, String> {
    if !es_una_clave_de_dia_valida(&clave_del_dia) {
        return Err(format!("Invalid date: {clave_del_dia}"));
    }
    let hormiguero = Path::new(&carpeta_del_hormiguero);
    if !hormiguero.is_dir() {
        return Err(format!("The folder {carpeta_del_hormiguero} does not exist"));
    }
    let carpeta_del_diario = carpeta_del_diario(hormiguero);
    fs::create_dir_all(&carpeta_del_diario).map_err(|error| format!("Could not create {}: {error}", carpeta_del_diario.display()))?;
    let ruta_de_la_nota = carpeta_del_diario.join(format!("{clave_del_dia}.md"));
    // `create_new` falla si el archivo ya existe: así nunca se pisa una nota escrita.
    match OpenOptions::new().write(true).create_new(true).open(&ruta_de_la_nota) {
        Ok(mut archivo_nuevo) => archivo_nuevo
            .write_all(texto_inicial.as_bytes())
            .map_err(|error| format!("Could not write {}: {error}", ruta_de_la_nota.display()))?,
        Err(error) if error.kind() == ErrorKind::AlreadyExists => {}
        Err(error) => return Err(format!("Could not create {}: {error}", ruta_de_la_nota.display())),
    }
    Ok(ruta_de_la_nota.to_string_lossy().into_owned())
}

/// Pruebas del modo diario: crea la carpeta y la nota, no pisa una nota existente y rechaza
/// fechas que podrían salirse de `Daily`.
#[cfg(test)]
mod pruebas {
    use super::*;

    /// Carpeta temporal vacía y única para cada prueba.
    fn carpeta_temporal(nombre_de_la_prueba: &str) -> String {
        let carpeta = std::env::temp_dir().join(format!("ant-diario-{nombre_de_la_prueba}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&carpeta);
        fs::create_dir_all(&carpeta).unwrap();
        carpeta.to_string_lossy().into_owned()
    }

    #[test]
    fn crea_carpeta_y_nota_y_no_la_pisa() {
        let hormiguero = carpeta_temporal("crear");
        let ruta_de_la_nota = abrir_o_crear_nota_del_dia(hormiguero.clone(), "2026-11-20".into(), "# Hoy\n".into()).unwrap();
        assert!(ruta_de_la_nota.ends_with("Daily/2026-11-20.md"));
        assert_eq!(fs::read_to_string(&ruta_de_la_nota).unwrap(), "# Hoy\n");
        fs::write(&ruta_de_la_nota, "escrito").unwrap();
        abrir_o_crear_nota_del_dia(hormiguero, "2026-11-20".into(), "# Otro\n".into()).unwrap();
        assert_eq!(fs::read_to_string(&ruta_de_la_nota).unwrap(), "escrito");
    }

    #[test]
    fn usa_la_carpeta_daily_que_ya_existe() {
        let hormiguero = carpeta_temporal("existente");
        fs::create_dir_all(Path::new(&hormiguero).join("daily")).unwrap();
        let ruta_de_la_nota = abrir_o_crear_nota_del_dia(hormiguero.clone(), "2026-11-21".into(), String::new()).unwrap();
        assert!(ruta_de_la_nota.ends_with("daily/2026-11-21.md"), "{ruta_de_la_nota}");
        assert_eq!(fs::read_dir(&hormiguero).unwrap().count(), 1);
    }

    #[test]
    fn rechaza_fechas_raras() {
        let hormiguero = carpeta_temporal("raras");
        for fecha_rara in ["../../x.md", "2026-11-2", "2026/11/20", "aaaa-bb-cc"] {
            assert!(abrir_o_crear_nota_del_dia(hormiguero.clone(), fecha_rara.into(), String::new()).is_err(), "{fecha_rara}");
        }
    }
}
