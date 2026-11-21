// Ajustes de la app (idioma, modo escritor, hormigueros y el que está abierto, fijados con sus
// iconos, ancho de la barra lateral, modo diario y colores), guardados como JSON en la carpeta de
// configuración de la app (en macOS, ~/Library/Application Support/cl.agus.ant/ajustes.json).
// Cada vez que se guardan, se avisa a la interfaz con el evento `ajustes-cambiados`. Si cambió el
// idioma, además se rehace el menú de la app en el idioma nuevo.
//
// Los nombres de los campos son los del archivo. Cuando uno cambia de nombre, el anterior se sigue
// aceptando con `#[serde(alias = …)]`, así los ajustes de versiones anteriores se leen igual (y
// al guardar quedan con el nombre nuevo).

use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter, Manager};

/// Nombre del evento que se emite a la interfaz al cambiar los ajustes.
pub const EVENTO_AJUSTES_CAMBIADOS: &str = "ajustes-cambiados";

/// Nombre del archivo de ajustes en la carpeta de configuración de la app.
const NOMBRE_DEL_ARCHIVO_DE_AJUSTES: &str = "ajustes.json";

/// Nombre de la copia que se guarda de un `ajustes.json` que no se pudo leer.
const COPIA_DE_AJUSTES_ILEGIBLES: &str = "ajustes-ilegibles.json";

/// Preferencias del usuario. Los campos nuevos deben tener `#[serde(default)]` para que un
/// archivo de una versión anterior se siga leyendo. Debe coincidir con `Ajustes` de `src/ajustes.ts`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Ajustes {
    /// Hormiguero abierto: la carpeta donde el usuario trabaja ahora; la barra lateral muestra su contenido.
    #[serde(default, alias = "carpeta")]
    pub hormiguero_abierto: Option<String>,
    /// Hormigueros del usuario (rutas de carpetas), en el orden en que se agregaron. Sin ninguno,
    /// la interfaz muestra la bienvenida para crear el primero.
    #[serde(default)]
    pub hormigueros: Vec<String>,
    /// Notas, carpetas y capítulos fijados arriba en la barra lateral, en el orden en que se
    /// fijaron: la ruta, o `ruta#título` para un capítulo (un título `#` dentro de una nota).
    #[serde(default)]
    pub fijados: Vec<String>,
    /// Icono elegido para cada fijado (nombre de un icono de `src/iconos.ts`), por su clave en
    /// `fijados`. Los que no están aquí usan el de su tipo (carpeta, nota o capítulo).
    #[serde(default, alias = "iconos")]
    pub iconos_de_fijados: BTreeMap<String, String>,
    /// Modo diario: muestra un calendario en la barra lateral y cada día abre su nota en `Daily/`.
    #[serde(default, alias = "diario")]
    pub modo_diario: bool,
    /// Colores del tema que el usuario eligió, por nombre de variable CSS sin `--` (por ejemplo
    /// `"acento": "#e5ea15"`). Las variables que no están aquí usan el color por defecto.
    #[serde(default, alias = "colores")]
    pub colores_elegidos: BTreeMap<String, String>,
    /// Ancho de la barra lateral en píxeles, si el usuario la ensanchó o achicó.
    #[serde(default, alias = "ancho_barra")]
    pub ancho_de_la_barra_lateral: Option<f64>,
    /// Idioma de la interfaz: `"en"` (por defecto) o `"es"`.
    #[serde(default = "idioma_por_defecto")]
    pub idioma: String,
    /// Modo escritor del editor; activo por defecto (Ant es primero para escritores).
    #[serde(default = "verdadero", alias = "escritor")]
    pub modo_escritor: bool,
    /// Opciones del modo escritor.
    #[serde(default, alias = "opciones_escritor")]
    pub opciones_del_modo_escritor: OpcionesDelModoEscritor,
    /// Nombre del autor para las portadas al compilar y exportar.
    #[serde(default, alias = "autor")]
    pub nombre_del_autor: String,
    /// Opciones de «Compilar y exportar» de cada carpeta (orden de los capítulos, formato,
    /// estilo…), por ruta de la carpeta. Su forma la define la interfaz (`OpcionesDeCompilacion`).
    #[serde(default, alias = "compilaciones")]
    pub opciones_de_compilacion_por_carpeta: BTreeMap<String, serde_json::Value>,
}

/// Opciones del modo escritor (ver `src/editor/escritor.ts`). Los campos que falten en el archivo
/// toman el valor de `Default`: todo activado y comillas según el idioma.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct OpcionesDelModoEscritor {
    /// Comillas rectas → tipográficas.
    #[serde(alias = "comillas")]
    pub comillas_tipograficas: bool,
    /// `"auto"` (según el idioma), `"curvas"` (“ ”) o `"latinas"` (« »).
    #[serde(alias = "estilo_comillas")]
    pub estilo_de_comillas: String,
    /// `--` → raya.
    #[serde(alias = "rayas")]
    pub rayas_de_dialogo: bool,
    /// `...` → puntos suspensivos.
    #[serde(alias = "puntos")]
    pub puntos_suspensivos: bool,
    /// `<<` `>>` → comillas latinas.
    #[serde(alias = "angulares")]
    pub comillas_angulares: bool,
    /// `->` `<-` → flechas.
    pub flechas: bool,
    /// Letra con serifa, más grande y en columna más angosta.
    #[serde(alias = "letra_libro")]
    pub letra_de_libro: bool,
    /// Corrector ortográfico del sistema.
    #[serde(alias = "corrector")]
    pub corrector_ortografico: bool,
}

impl Default for OpcionesDelModoEscritor {
    fn default() -> Self {
        OpcionesDelModoEscritor {
            comillas_tipograficas: true,
            estilo_de_comillas: "auto".into(),
            rayas_de_dialogo: true,
            puntos_suspensivos: true,
            comillas_angulares: true,
            flechas: true,
            letra_de_libro: true,
            corrector_ortografico: true,
        }
    }
}

/// Para los campos que valen `true` si no están en el archivo.
fn verdadero() -> bool {
    true
}

/// Ant está en inglés salvo que el usuario elija otro idioma.
fn idioma_por_defecto() -> String {
    "en".into()
}

/// Valores de una instalación nueva (o de un archivo de ajustes ilegible).
impl Default for Ajustes {
    fn default() -> Self {
        Ajustes {
            hormiguero_abierto: None,
            hormigueros: Vec::new(),
            fijados: Vec::new(),
            iconos_de_fijados: BTreeMap::new(),
            modo_diario: false,
            colores_elegidos: BTreeMap::new(),
            ancho_de_la_barra_lateral: None,
            idioma: idioma_por_defecto(),
            modo_escritor: true,
            opciones_del_modo_escritor: OpcionesDelModoEscritor::default(),
            nombre_del_autor: String::new(),
            opciones_de_compilacion_por_carpeta: BTreeMap::new(),
        }
    }
}

/// Ruta del archivo de ajustes dentro de la carpeta de configuración de la app.
fn ruta_del_archivo_de_ajustes(app: &AppHandle) -> Result<PathBuf, String> {
    let carpeta_de_configuracion = app.path().app_config_dir().map_err(|error| error.to_string())?;
    Ok(carpeta_de_configuracion.join(NOMBRE_DEL_ARCHIVO_DE_AJUSTES))
}

/// Lee los ajustes guardados. Si el archivo no existe o está dañado, devuelve los valores por defecto.
#[tauri::command]
pub fn leer_ajustes(app: AppHandle) -> Ajustes {
    match ruta_del_archivo_de_ajustes(&app) {
        Ok(ruta_del_archivo) => leer_ajustes_del_archivo(&ruta_del_archivo),
        Err(_) => Ajustes::default(),
    }
}

/// Lee `ajustes.json`. Si existe pero no se puede entender (se dañó), antes de seguir con los
/// valores por defecto guarda una copia (`ajustes-ilegibles.json`, junto al original), así los
/// hormigueros y demás ajustes no se pierden para siempre al guardar los nuevos encima.
fn leer_ajustes_del_archivo(ruta_del_archivo: &Path) -> Ajustes {
    let Ok(texto_del_archivo) = fs::read_to_string(ruta_del_archivo) else { return Ajustes::default() };
    match serde_json::from_str::<Ajustes>(&texto_del_archivo) {
        Ok(ajustes) => con_el_hormiguero_abierto_en_la_lista(ajustes),
        Err(error) => {
            let ruta_de_la_copia = ruta_del_archivo.with_file_name(COPIA_DE_AJUSTES_ILEGIBLES);
            if !ruta_de_la_copia.exists() {
                let _ = fs::copy(ruta_del_archivo, &ruta_de_la_copia);
            }
            eprintln!("Could not read the settings ({error}); a copy was kept in {}", ruta_de_la_copia.display());
            Ajustes::default()
        }
    }
}

/// Los ajustes de antes de los hormigueros (0.2.0 y anteriores) solo tenían `carpeta`: esa
/// carpeta pasa a ser el primer hormiguero, así quien actualiza no ve la bienvenida.
fn con_el_hormiguero_abierto_en_la_lista(mut ajustes: Ajustes) -> Ajustes {
    if let Some(hormiguero_abierto) = &ajustes.hormiguero_abierto {
        if !ajustes.hormigueros.contains(hormiguero_abierto) {
            ajustes.hormigueros.push(hormiguero_abierto.clone());
        }
    }
    ajustes
}

#[cfg(test)]
mod pruebas {
    use super::*;

    #[test]
    fn la_carpeta_de_antes_pasa_a_ser_un_hormiguero() {
        let ajustes_viejos: Ajustes = serde_json::from_str(r#"{"carpeta": "/notas", "fijados": ["/notas/a.md"]}"#).unwrap();
        let ajustes = con_el_hormiguero_abierto_en_la_lista(ajustes_viejos);
        assert_eq!(ajustes.hormiguero_abierto.as_deref(), Some("/notas"));
        assert_eq!(ajustes.hormigueros, vec!["/notas".to_string()]);
        assert_eq!(ajustes.fijados, vec!["/notas/a.md".to_string()]);
        assert!(con_el_hormiguero_abierto_en_la_lista(Ajustes::default()).hormigueros.is_empty());
    }

    #[test]
    fn lee_los_nombres_anteriores_de_los_campos_y_guarda_los_nuevos() {
        let ajustes_anteriores = r##"{
            "carpeta": "/notas", "iconos": {"/notas/a.md": "star"}, "diario": true,
            "colores": {"acento": "#e5ea15"}, "ancho_barra": 240, "escritor": false,
            "opciones_escritor": {"comillas": false, "estilo_comillas": "latinas", "rayas": false,
              "puntos": false, "angulares": false, "letra_libro": false, "corrector": false},
            "autor": "Mira", "compilaciones": {"/notas": {"titulo": "La colonia"}}
        }"##;
        let ajustes: Ajustes = serde_json::from_str(ajustes_anteriores).unwrap();
        assert_eq!(ajustes.hormiguero_abierto.as_deref(), Some("/notas"));
        assert_eq!(ajustes.iconos_de_fijados.get("/notas/a.md").map(String::as_str), Some("star"));
        assert!(ajustes.modo_diario);
        assert_eq!(ajustes.colores_elegidos.get("acento").map(String::as_str), Some("#e5ea15"));
        assert_eq!(ajustes.ancho_de_la_barra_lateral, Some(240.0));
        assert!(!ajustes.modo_escritor);
        let opciones = &ajustes.opciones_del_modo_escritor;
        assert!(!opciones.comillas_tipograficas && !opciones.rayas_de_dialogo && !opciones.puntos_suspensivos);
        assert!(!opciones.comillas_angulares && !opciones.letra_de_libro && !opciones.corrector_ortografico);
        assert_eq!(opciones.estilo_de_comillas, "latinas");
        assert!(opciones.flechas);
        assert_eq!(ajustes.nombre_del_autor, "Mira");
        assert!(ajustes.opciones_de_compilacion_por_carpeta.contains_key("/notas"));
        let ajustes_guardados = serde_json::to_string(&ajustes).unwrap();
        assert!(ajustes_guardados.contains("\"hormiguero_abierto\"") && !ajustes_guardados.contains("\"carpeta\""));
    }

    #[test]
    fn guarda_una_copia_de_los_ajustes_ilegibles() {
        let carpeta_de_prueba = std::env::temp_dir().join(format!("ant-ajustes-{}", std::process::id()));
        fs::create_dir_all(&carpeta_de_prueba).unwrap();
        let ruta_del_archivo = carpeta_de_prueba.join(NOMBRE_DEL_ARCHIVO_DE_AJUSTES);
        fs::write(&ruta_del_archivo, "{ esto no es JSON").unwrap();
        let ajustes = leer_ajustes_del_archivo(&ruta_del_archivo);
        assert!(ajustes.hormigueros.is_empty());
        let copia = fs::read_to_string(carpeta_de_prueba.join(COPIA_DE_AJUSTES_ILEGIBLES)).unwrap();
        assert_eq!(copia, "{ esto no es JSON");
        fs::remove_dir_all(carpeta_de_prueba).unwrap();
    }
}

/// Guarda los ajustes en disco y avisa a la interfaz. Si cambió el idioma, traduce el menú de la
/// app. Escribe con `escribir_atomico` (archivo temporal + renombrar): un corte a mitad de
/// escritura nunca deja `ajustes.json` a medias.
#[tauri::command]
pub fn guardar_ajustes(app: AppHandle, ajustes: Ajustes) -> Result<(), String> {
    let idioma_anterior = leer_ajustes(app.clone()).idioma;
    let ruta_del_archivo = ruta_del_archivo_de_ajustes(&app)?;
    if let Some(carpeta_de_configuracion) = ruta_del_archivo.parent() {
        fs::create_dir_all(carpeta_de_configuracion)
            .map_err(|error| format!("Could not create {}: {error}", carpeta_de_configuracion.display()))?;
    }
    let texto_de_los_ajustes = serde_json::to_string_pretty(&ajustes).map_err(|error| error.to_string())?;
    crate::escribir_atomico(&ruta_del_archivo, texto_de_los_ajustes.as_bytes())
        .map_err(|error| format!("Could not save the settings: {error}"))?;
    if ajustes.idioma != idioma_anterior {
        crate::menu::cambiar_idioma(&app, &ajustes.idioma);
    }
    app.emit(EVENTO_AJUSTES_CAMBIADOS, &ajustes).map_err(|error| error.to_string())
}
