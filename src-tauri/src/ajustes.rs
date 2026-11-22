// Ajustes de la app: lo que es de este computador (idioma, modo escritor, el hormiguero y la cámara
// abierta, ancho de la barra lateral, modo diario y colores), guardados como JSON en la carpeta de
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
    /// El hormiguero: la carpeta donde viven todas las notas del usuario (lo que en Obsidian es la
    /// bóveda). Sin hormiguero, la interfaz muestra la bienvenida para elegirlo o crearlo. Antes se
    /// llamó `hormiguero_abierto` (cuando podía haber varios) y `carpeta`.
    #[serde(default, alias = "hormiguero_abierto", alias = "carpeta")]
    pub hormiguero: Option<String>,
    /// Cámara abierta: el nombre de una carpeta de primer nivel del hormiguero (un contexto: notas
    /// personales, una novela, el trabajo). La barra lateral muestra su contenido. Se guarda el
    /// nombre y no la ruta, así sigue sirviendo si el hormiguero se mueve.
    #[serde(default)]
    pub camara_abierta: Option<String>,
    /// Ruta de la última nota que se abrió: al volver a entrar a la app se abre esa. `None` si se
    /// cerró la última nota (la app arranca sin notas, con la invitación a crear una).
    #[serde(default)]
    pub ultima_nota_abierta: Option<String>,
    /// De antes: fijados con rutas completas (la ruta, o `ruta#título` para un capítulo). Ahora
    /// van en `.ant/` de cada cámara (`datos_del_hormiguero.rs`); la interfaz pasa allá los de una
    /// cámara la primera vez que se abre y los quita de aquí.
    #[serde(default)]
    pub fijados: Vec<String>,
    /// De antes (ahora en `.ant/`): icono elegido para cada fijado, por su clave en `fijados`.
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
    /// De antes (ahora en `.ant/`): opciones de «Compilar y exportar» de cada carpeta, por ruta.
    #[serde(default, alias = "compilaciones")]
    pub opciones_de_compilacion_por_carpeta: BTreeMap<String, serde_json::Value>,
    /// Atajos de teclado que el usuario cambió (Ajustes → Atajos), por id de acción (ver
    /// `src/atajos.ts`), como `CmdOrCtrl+Shift+KeyN`. El menú usa los de `ajustes`,
    /// `camara_nueva` y `compilar`; los demás, la ventana.
    #[serde(default)]
    pub atajos_de_teclado: BTreeMap<String, String>,
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
            hormiguero: None,
            camara_abierta: None,
            ultima_nota_abierta: None,
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
            atajos_de_teclado: BTreeMap::new(),
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
/// el hormiguero y demás ajustes no se pierden para siempre al guardar los nuevos encima.
fn leer_ajustes_del_archivo(ruta_del_archivo: &Path) -> Ajustes {
    let Ok(texto_del_archivo) = fs::read_to_string(ruta_del_archivo) else { return Ajustes::default() };
    match serde_json::from_str::<Ajustes>(&texto_del_archivo) {
        Ok(ajustes) => ajustes,
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

#[cfg(test)]
mod pruebas {
    use super::*;

    #[test]
    fn el_hormiguero_se_lee_con_sus_nombres_anteriores() {
        let de_la_version_0_2: Ajustes = serde_json::from_str(r#"{"carpeta": "/notas", "fijados": ["/notas/a.md"]}"#).unwrap();
        assert_eq!(de_la_version_0_2.hormiguero.as_deref(), Some("/notas"));
        assert_eq!(de_la_version_0_2.fijados, vec!["/notas/a.md".to_string()]);
        assert_eq!(de_la_version_0_2.camara_abierta, None);
        // Con varios hormigueros, el abierto pasa a ser el hormiguero y la lista se ignora.
        let con_varios: Ajustes =
            serde_json::from_str(r#"{"hormiguero_abierto": "/novela", "hormigueros": ["/novela", "/diario"]}"#).unwrap();
        assert_eq!(con_varios.hormiguero.as_deref(), Some("/novela"));
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
        assert_eq!(ajustes.hormiguero.as_deref(), Some("/notas"));
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
        assert!(ajustes_guardados.contains("\"hormiguero\"") && !ajustes_guardados.contains("\"carpeta\""));
    }

    #[test]
    fn guarda_una_copia_de_los_ajustes_ilegibles() {
        let carpeta_de_prueba = std::env::temp_dir().join(format!("ant-ajustes-{}", std::process::id()));
        fs::create_dir_all(&carpeta_de_prueba).unwrap();
        let ruta_del_archivo = carpeta_de_prueba.join(NOMBRE_DEL_ARCHIVO_DE_AJUSTES);
        fs::write(&ruta_del_archivo, "{ esto no es JSON").unwrap();
        let ajustes = leer_ajustes_del_archivo(&ruta_del_archivo);
        assert!(ajustes.hormiguero.is_none());
        let copia = fs::read_to_string(carpeta_de_prueba.join(COPIA_DE_AJUSTES_ILEGIBLES)).unwrap();
        assert_eq!(copia, "{ esto no es JSON");
        fs::remove_dir_all(carpeta_de_prueba).unwrap();
    }
}

/// Guarda los ajustes en disco y avisa a la interfaz. Si cambió el idioma o un atajo, rehace el
/// menú de la app. Escribe con `escribir_atomico` (archivo temporal + renombrar): un corte a mitad de
/// escritura nunca deja `ajustes.json` a medias.
#[tauri::command]
pub fn guardar_ajustes(app: AppHandle, ajustes: Ajustes) -> Result<(), String> {
    let ajustes_anteriores = leer_ajustes(app.clone());
    let ruta_del_archivo = ruta_del_archivo_de_ajustes(&app)?;
    if let Some(carpeta_de_configuracion) = ruta_del_archivo.parent() {
        fs::create_dir_all(carpeta_de_configuracion)
            .map_err(|error| format!("Could not create {}: {error}", carpeta_de_configuracion.display()))?;
    }
    let texto_de_los_ajustes = serde_json::to_string_pretty(&ajustes).map_err(|error| error.to_string())?;
    crate::escribir_atomico(&ruta_del_archivo, texto_de_los_ajustes.as_bytes())
        .map_err(|error| format!("Could not save the settings: {error}"))?;
    if ajustes.idioma != ajustes_anteriores.idioma || ajustes.atajos_de_teclado != ajustes_anteriores.atajos_de_teclado {
        crate::menu::rehacer(&app, &ajustes);
    }
    app.emit(EVENTO_AJUSTES_CAMBIADOS, &ajustes).map_err(|error| error.to_string())
}
