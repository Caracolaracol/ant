// Carpetas del hormiguero y sus cámaras: las cámaras que tiene el hormiguero (sus carpetas de
// primer nivel y, si hay notas sueltas en la raíz, la «Entrada»), el árbol de la cámara abierta
// para la barra lateral (subcarpetas y notas .md, .markdown, .txt, con las carpetas primero y luego
// por nombre), la creación de carpetas y notas nuevas y el cambio de nombre de una cámara.

use serde::Serialize;
use std::fs;
use std::path::Path;

/// Extensiones de archivo que se consideran notas.
const EXTENSIONES_DE_NOTAS: [&str; 3] = ["md", "markdown", "txt"];
/// Carpetas que nunca se muestran (dependencias de proyectos), además de las ocultas (que empiezan con «.»).
const CARPETAS_IGNORADAS: [&str; 2] = ["node_modules", "target"];
/// Nombre con que se lista la «Entrada»: la cámara de las notas sueltas en la raíz del hormiguero.
/// Es «.» (la carpeta misma) porque ninguna carpeta de verdad puede llamarse así; la interfaz lo
/// muestra como «Entrada» (`CAMARA_DE_ENTRADA` en `src/hormigueros/hormigueros.ts`).
pub const CAMARA_DE_ENTRADA: &str = ".";
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
/// muestre solo lo útil (por ejemplo, una de imágenes), salvo las que están del todo vacías: una
/// recién creada (clic derecho → Carpeta nueva…) tiene que verse para poder llenarla. Los errores
/// de lectura de una subcarpeta (permisos) se saltan en silencio.
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
                if es_carpeta_ignorada(&nombre) || profundidad >= PROFUNDIDAD_MAXIMA_DEL_ARBOL {
                    return None;
                }
                let hijos = leer_arbol(&ruta, profundidad + 1);
                if hijos.is_empty() && !esta_vacia(&ruta) {
                    return None;
                }
                Some(EntradaDelArbol { nombre, ruta: ruta.to_string_lossy().into_owned(), es_carpeta: true, hijos })
            } else {
                // Una nota cifrada (`Banco.md.age`, en una cámara cifrada) se muestra con su
                // nombre sin `.age`: para el resto de la app se llama `Banco.md`.
                let (nombre, ruta) = match nombre.strip_suffix(".age") {
                    Some(nombre_sin_cifrar) => (nombre_sin_cifrar.to_string(), ruta.with_extension("")),
                    None => (nombre, ruta),
                };
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
    // Si una nota quedó a la vez cifrada y sin cifrar (un corte a mitad de cifrar), va una sola vez.
    entradas.sort_by(|una, otra| una.ruta.cmp(&otra.ruta));
    entradas.dedup_by(|una, otra| una.ruta == otra.ruta);
    // Carpetas primero; dentro de cada grupo, orden alfabético sin distinguir mayúsculas.
    entradas.sort_by(|una, otra| {
        otra.es_carpeta.cmp(&una.es_carpeta).then_with(|| una.nombre.to_lowercase().cmp(&otra.nombre.to_lowercase()))
    });
    entradas
}

/// Si una carpeta se ignora siempre: las ocultas (`.ant`, `.obsidian`, `.git`…) y las de
/// dependencias de proyectos.
fn es_carpeta_ignorada(nombre: &str) -> bool {
    nombre.starts_with('.') || CARPETAS_IGNORADAS.contains(&nombre)
}

/// Si una carpeta no tiene nada visible adentro (ignora lo oculto, como `.DS_Store`).
fn esta_vacia(carpeta: &Path) -> bool {
    fs::read_dir(carpeta).is_ok_and(|mut contenido| {
        !contenido.any(|elemento| elemento.is_ok_and(|elemento| !elemento.file_name().to_string_lossy().starts_with('.')))
    })
}

/// Si el archivo es una nota (por su extensión, sin distinguir mayúsculas) y no está oculto.
fn es_archivo_de_nota(ruta: &Path) -> bool {
    let esta_oculto = ruta.file_name().is_some_and(|nombre| nombre.to_string_lossy().starts_with('.'));
    let extension = ruta.extension().and_then(|extension| extension.to_str()).map(str::to_lowercase);
    !esta_oculto && extension.is_some_and(|extension| EXTENSIONES_DE_NOTAS.contains(&extension.as_str()))
}

/// Notas sueltas de una carpeta: solo sus archivos de notas, sin entrar en las subcarpetas. Es el
/// árbol de la «Entrada» (las de la raíz del hormiguero; las subcarpetas son las otras cámaras).
fn notas_sueltas_de(carpeta: &Path) -> Vec<EntradaDelArbol> {
    let Ok(contenido_de_la_carpeta) = fs::read_dir(carpeta) else { return Vec::new() };
    let mut notas: Vec<EntradaDelArbol> = contenido_de_la_carpeta
        .filter_map(Result::ok)
        .map(|elemento| elemento.path())
        .filter(|ruta| ruta.is_file() && es_archivo_de_nota(ruta))
        .map(|ruta| EntradaDelArbol {
            nombre: ruta.file_name().unwrap_or_default().to_string_lossy().into_owned(),
            ruta: ruta.to_string_lossy().into_owned(),
            es_carpeta: false,
            hijos: Vec::new(),
        })
        .collect();
    notas.sort_by_key(|nota| nota.nombre.to_lowercase());
    notas
}

/// Devuelve el árbol de notas de una carpeta o, con `solo_notas_sueltas` (la «Entrada»), solo las
/// notas de su primer nivel. Corre en un hilo aparte (`en_segundo_plano`): un hormiguero con miles
/// de notas no traba la ventana mientras se lee.
#[tauri::command]
pub async fn leer_arbol_de_carpeta(ruta_de_la_carpeta: String, solo_notas_sueltas: Option<bool>) -> Result<Vec<EntradaDelArbol>, String> {
    crate::en_segundo_plano(move || {
        let carpeta = Path::new(&ruta_de_la_carpeta);
        if !carpeta.is_dir() {
            return Err(format!("The folder {ruta_de_la_carpeta} does not exist"));
        }
        Ok(if solo_notas_sueltas.unwrap_or(false) { notas_sueltas_de(carpeta) } else { leer_arbol(carpeta, 0) })
    })
    .await
}

/// Cámaras del hormiguero: los nombres de sus carpetas de primer nivel (sin las ocultas ni las de
/// dependencias), en orden alfabético sin distinguir mayúsculas. A diferencia del árbol, incluye
/// las carpetas vacías: una cámara recién cavada todavía no tiene notas. Si en la raíz hay notas
/// sueltas, la primera es la «Entrada» (`CAMARA_DE_ENTRADA`); sin notas sueltas, no aparece.
fn camaras_de(carpeta_del_hormiguero: &Path) -> Result<Vec<String>, String> {
    let contenido = fs::read_dir(carpeta_del_hormiguero)
        .map_err(|error| format!("Could not read the anthill {}: {error}", carpeta_del_hormiguero.display()))?;
    let mut hay_notas_sueltas = false;
    let mut nombres_de_las_camaras: Vec<String> = Vec::new();
    for elemento in contenido.filter_map(Result::ok) {
        let ruta = elemento.path();
        if ruta.is_dir() {
            let nombre = elemento.file_name().to_string_lossy().into_owned();
            if !es_carpeta_ignorada(&nombre) {
                nombres_de_las_camaras.push(nombre);
            }
        } else if es_archivo_de_nota(&ruta) {
            hay_notas_sueltas = true;
        }
    }
    nombres_de_las_camaras.sort_by_key(|nombre| nombre.to_lowercase());
    if hay_notas_sueltas {
        nombres_de_las_camaras.insert(0, CAMARA_DE_ENTRADA.to_string());
    }
    Ok(nombres_de_las_camaras)
}

/// Devuelve las cámaras del hormiguero (ver `camaras_de`), fuera del hilo principal.
#[tauri::command]
pub async fn listar_camaras(carpeta_del_hormiguero: String) -> Result<Vec<String>, String> {
    crate::en_segundo_plano(move || camaras_de(Path::new(&carpeta_del_hormiguero))).await
}

/// Comprueba que un cambio de nombre no pise otro elemento; acepta la misma entrada si el
/// sistema de archivos no distingue mayúsculas y solo cambió la forma de escribir su nombre.
fn comprobar_destino_de_renombrado(origen: &Path, destino: &Path) -> Result<(), String> {
    match fs::symlink_metadata(destino) {
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Ok(datos) if !datos.is_symlink() && fs::canonicalize(origen).is_ok_and(|ruta| fs::canonicalize(destino).is_ok_and(|otra| ruta == otra)) => Ok(()),
        Ok(_) => Err(format!("{} already exists", destino.display())),
        Err(error) => Err(format!("Could not check {}: {error}", destino.display())),
    }
}

/// Cambia el nombre de una cámara real y mueve su archivo de `.ant/` sin modificar su contenido.
/// Las rutas de ese archivo son relativas, así que no se reescriben. Si falla el segundo cambio de
/// nombre, intenta devolver la carpeta a su sitio y no borra nada.
fn cambiar_nombre_de_camara(hormiguero: &Path, nombre_anterior: &str, nombre_nuevo: &str) -> Result<(), String> {
    if nombre_anterior.is_empty() || es_carpeta_ignorada(nombre_anterior) || nombre_anterior.contains(['/', '\\', ':', '\0']) {
        return Err(format!("“{nombre_anterior}” is not a chamber"));
    }
    if nombre_nuevo.is_empty() || es_carpeta_ignorada(nombre_nuevo) || nombre_nuevo.ends_with('.')
        || nombre_nuevo.contains(['/', '\\', ':', '\0', '"', '*', '?', '<', '>', '|'])
    {
        return Err(format!("“{nombre_nuevo}” cannot be a chamber name"));
    }
    let carpeta_anterior = hormiguero.join(nombre_anterior);
    let carpeta_nueva = hormiguero.join(nombre_nuevo);
    if !fs::symlink_metadata(&carpeta_anterior).is_ok_and(|datos| datos.is_dir()) {
        return Err(format!("{} is not a chamber folder", carpeta_anterior.display()));
    }
    if nombre_anterior == nombre_nuevo { return Ok(()); }

    let archivo_anterior = crate::datos_del_hormiguero::archivo_de_la_camara(hormiguero, nombre_anterior)?;
    let archivo_nuevo = crate::datos_del_hormiguero::archivo_de_la_camara(hormiguero, nombre_nuevo)?;
    let hay_archivo = match fs::symlink_metadata(&archivo_anterior) {
        Ok(datos) if datos.is_file() => true,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => false,
        _ => return Err(format!("Could not access the chamber settings at {}", archivo_anterior.display())),
    };
    comprobar_destino_de_renombrado(&carpeta_anterior, &carpeta_nueva)?;
    comprobar_destino_de_renombrado(&archivo_anterior, &archivo_nuevo)?;
    fs::rename(&carpeta_anterior, &carpeta_nueva)
        .map_err(|error| format!("Could not rename {}: {error}", carpeta_anterior.display()))?;
    if hay_archivo && let Err(error) = fs::rename(&archivo_anterior, &archivo_nuevo) {
        let mensaje = format!("Could not move the chamber settings at {}: {error}", archivo_anterior.display());
        return match fs::rename(&carpeta_nueva, &carpeta_anterior) {
            Ok(()) => Err(mensaje),
            Err(error_al_volver) => Err(format!("{mensaje}. The folder is at {} and couldn't be moved back: {error_al_volver}", carpeta_nueva.display())),
        };
    }
    Ok(())
}

/// Renombra en segundo plano; una cámara cifrada se vuelve a desbloquear con su nueva ruta.
#[tauri::command]
pub async fn renombrar_camara(app: tauri::AppHandle, carpeta_del_hormiguero: String, nombre_anterior: String, nombre_nuevo: String) -> Result<String, String> {
    let llaves = crate::camaras_cifradas::llaves_de(&app);
    crate::en_segundo_plano(move || {
        let hormiguero = Path::new(&carpeta_del_hormiguero);
        let nombre_nuevo = nombre_nuevo.trim();
        cambiar_nombre_de_camara(hormiguero, &nombre_anterior, nombre_nuevo)?;
        if nombre_anterior != nombre_nuevo {
            llaves.olvidar_llave(&hormiguero.join(&nombre_anterior));
        }
        Ok(nombre_nuevo.to_string())
    }).await
}

/// Crea la carpeta `nombre_de_la_carpeta` dentro de `carpeta_donde_crearla` y devuelve su ruta: un
/// hormiguero nuevo (en Documentos u otro lugar) o una cámara nueva (dentro del hormiguero). No usa
/// una carpeta que ya exista (para eso está «elegir una carpeta» o abrir esa cámara), así nunca
/// mezcla algo nuevo con lo que ya había ahí.
#[tauri::command]
pub fn crear_carpeta_nueva(carpeta_donde_crearla: String, nombre_de_la_carpeta: String) -> Result<String, String> {
    let nombre = nombre_de_la_carpeta.trim();
    if nombre.is_empty() || nombre.starts_with('.') || nombre.contains(['/', '\\', ':']) {
        return Err(format!("“{nombre}” cannot be a folder name"));
    }
    let carpeta_padre = Path::new(&carpeta_donde_crearla);
    if !carpeta_padre.is_dir() {
        return Err(format!("The folder {} does not exist", carpeta_padre.display()));
    }
    let carpeta_nueva = carpeta_padre.join(nombre);
    if carpeta_nueva.exists() {
        return Err(format!("There is already a “{nombre}” folder in {}", carpeta_padre.display()));
    }
    fs::create_dir(&carpeta_nueva).map_err(|error| format!("Could not create {}: {error}", carpeta_nueva.display()))?;
    Ok(carpeta_nueva.to_string_lossy().into_owned())
}

/// Crea una nota vacía `nombre_de_la_nota` dentro de `carpeta_donde_crearla` (le agrega `.md` si
/// no termina en una extensión de notas) y devuelve su ruta. Es «Nota nueva» (Cmd+N, clic
/// derecho). Nunca pisa una nota que ya existe: si el nombre está tomado, falla con un aviso. En
/// una cámara cifrada la crea cifrada (ver `camaras_cifradas.rs`).
#[tauri::command]
pub fn crear_nota_nueva(app: tauri::AppHandle, carpeta_donde_crearla: String, nombre_de_la_nota: String) -> Result<String, String> {
    crear_nota(&crate::camaras_cifradas::llaves_de(&app), &carpeta_donde_crearla, &nombre_de_la_nota)
}

/// Lo que hace `crear_nota_nueva`, con las llaves de las cámaras cifradas a mano (para probarlo).
fn crear_nota(llaves: &crate::camaras_cifradas::LlavesAbiertas, carpeta_donde_crearla: &str, nombre_de_la_nota: &str) -> Result<String, String> {
    let nombre = nombre_de_la_nota.trim();
    if nombre.is_empty() || nombre.starts_with('.') || nombre.contains(['/', '\\', ':']) {
        return Err(format!("“{nombre}” cannot be a note name"));
    }
    let carpeta = Path::new(&carpeta_donde_crearla);
    if !carpeta.is_dir() {
        return Err(format!("The folder {} does not exist", carpeta.display()));
    }
    let nombre_del_archivo = if es_archivo_de_nota(Path::new(nombre)) { nombre.to_string() } else { format!("{nombre}.md") };
    let ruta_de_la_nota = carpeta.join(&nombre_del_archivo);
    if crate::camaras_cifradas::camara_cifrada_que_contiene(&ruta_de_la_nota).is_some() {
        if crate::camaras_cifradas::existe(&ruta_de_la_nota) {
            return Err(format!("There is already a note “{nombre_del_archivo}” in {}", carpeta.display()));
        }
        crate::camaras_cifradas::escribir_archivo(llaves, &ruta_de_la_nota, b"")?;
        return Ok(ruta_de_la_nota.to_string_lossy().into_owned());
    }
    // `create_new` falla si el archivo ya existe, sin la carrera de mirar primero y crear después.
    fs::OpenOptions::new().write(true).create_new(true).open(&ruta_de_la_nota).map_err(|error| {
        if error.kind() == std::io::ErrorKind::AlreadyExists {
            format!("There is already a note “{nombre_del_archivo}” in {}", carpeta.display())
        } else {
            format!("Could not create {}: {error}", ruta_de_la_nota.display())
        }
    })?;
    Ok(ruta_de_la_nota.to_string_lossy().into_owned())
}

#[cfg(test)]
mod pruebas {
    use super::*;

    #[test]
    fn crea_la_carpeta_sin_pisar_una_que_existe() {
        let carpeta_de_prueba = std::env::temp_dir().join(format!("ant-hormiguero-{}", std::process::id()));
        fs::create_dir_all(&carpeta_de_prueba).unwrap();
        let carpeta_padre = carpeta_de_prueba.to_string_lossy().into_owned();
        let carpeta_creada = crear_carpeta_nueva(carpeta_padre.clone(), " Novela ".into()).unwrap();
        assert!(Path::new(&carpeta_creada).is_dir());
        assert!(carpeta_creada.ends_with("Novela"));
        assert!(crear_carpeta_nueva(carpeta_padre.clone(), "Novela".into()).is_err());
        assert!(crear_carpeta_nueva(carpeta_padre.clone(), "a/b".into()).is_err());
        assert!(crear_carpeta_nueva(carpeta_padre.clone(), "  ".into()).is_err());
        assert!(crear_carpeta_nueva(carpeta_padre, ".oculta".into()).is_err());
        fs::remove_dir_all(carpeta_de_prueba).unwrap();
    }

    #[test]
    fn las_camaras_son_las_carpetas_de_primer_nivel() {
        let hormiguero = std::env::temp_dir().join(format!("ant-camaras-{}", std::process::id()));
        for carpeta in ["trabajo", "Novela/Capítulos", "Personal", ".ant", "node_modules"] {
            fs::create_dir_all(hormiguero.join(carpeta)).unwrap();
        }
        fs::write(hormiguero.join("imagen.png"), "no es una nota").unwrap();
        assert_eq!(camaras_de(&hormiguero).unwrap(), vec!["Novela", "Personal", "trabajo"]);
        // Con una nota suelta en la raíz aparece la «Entrada», primera, y su árbol tiene solo esa nota.
        fs::write(hormiguero.join("Suelta.MD"), "nota fuera de las cámaras").unwrap();
        assert_eq!(camaras_de(&hormiguero).unwrap(), vec![CAMARA_DE_ENTRADA, "Novela", "Personal", "trabajo"]);
        let notas_de_la_entrada = notas_sueltas_de(&hormiguero);
        assert_eq!(notas_de_la_entrada.len(), 1);
        assert_eq!(notas_de_la_entrada[0].nombre, "Suelta.MD");
        fs::remove_dir_all(&hormiguero).unwrap();
        assert!(camaras_de(&hormiguero).is_err());
    }

    /// Mueve notas y ajustes sin tocar sus bytes, y nunca mezcla cámaras ni pisa datos huérfanos.
    #[test]
    fn renombra_la_camara_y_sus_datos() {
        let hormiguero = std::env::temp_dir().join(format!("ant-renombrar-camara-{}", std::process::id()));
        for carpeta in ["Novela/Capitulos", "Trabajo", ".ant/camaras"] {
            fs::create_dir_all(hormiguero.join(carpeta)).unwrap();
        }
        fs::write(hormiguero.join("Novela/Capitulos/01.md.age"), b"nota cifrada").unwrap();
        fs::write(hormiguero.join("Novela/.ant-llave.age"), b"llave cifrada").unwrap();
        let ajustes = br#"{"fijados":["Capitulos/01.md"]}"#;
        fs::write(hormiguero.join(".ant/camaras/Novela.json"), ajustes).unwrap();
        fs::write(hormiguero.join(".ant/camaras/Personal.json"), b"datos previos").unwrap();
        for nombre_nuevo in ["Trabajo", "Personal", "..", "../otra", "target", "con/barra"] {
            assert!(cambiar_nombre_de_camara(&hormiguero, "Novela", nombre_nuevo).is_err(), "{nombre_nuevo}");
        }
        assert!(cambiar_nombre_de_camara(&hormiguero, CAMARA_DE_ENTRADA, "Entrada real").is_err());
        assert!(hormiguero.join("Novela").is_dir());
        assert_eq!(fs::read(hormiguero.join(".ant/camaras/Personal.json")).unwrap(), b"datos previos");

        cambiar_nombre_de_camara(&hormiguero, "Novela", "Libro").unwrap();
        assert!(!hormiguero.join("Novela").exists());
        assert!(!hormiguero.join(".ant/camaras/Novela.json").exists());
        assert_eq!(fs::read(hormiguero.join("Libro/Capitulos/01.md.age")).unwrap(), b"nota cifrada");
        assert_eq!(fs::read(hormiguero.join("Libro/.ant-llave.age")).unwrap(), b"llave cifrada");
        assert_eq!(fs::read(hormiguero.join(".ant/camaras/Libro.json")).unwrap(), ajustes);
        cambiar_nombre_de_camara(&hormiguero, "Libro", "libro").unwrap();
        assert_eq!(camaras_de(&hormiguero).unwrap(), vec!["libro", "Trabajo"]);
        fs::remove_dir_all(&hormiguero).unwrap();
    }

    #[test]
    fn crea_la_nota_nueva_sin_pisar_otra() {
        let carpeta_de_prueba = std::env::temp_dir().join(format!("ant-nota-nueva-{}", std::process::id()));
        fs::create_dir_all(&carpeta_de_prueba).unwrap();
        let carpeta = carpeta_de_prueba.to_string_lossy().into_owned();
        let nota_creada = crear_nota(&Default::default(), &carpeta, " Capítulo 1 ").unwrap();
        assert!(nota_creada.ends_with("Capítulo 1.md"));
        assert_eq!(fs::read_to_string(&nota_creada).unwrap(), "");
        fs::write(&nota_creada, "texto que no se pisa").unwrap();
        assert!(crear_nota(&Default::default(), &carpeta, "Capítulo 1").is_err());
        assert_eq!(fs::read_to_string(&nota_creada).unwrap(), "texto que no se pisa");
        assert!(crear_nota(&Default::default(), &carpeta, "ideas.txt").unwrap().ends_with("ideas.txt"));
        assert!(crear_nota(&Default::default(), &carpeta, "a/b").is_err());
        assert!(crear_nota(&Default::default(), &carpeta, "").is_err());
        fs::remove_dir_all(carpeta_de_prueba).unwrap();
    }

    #[test]
    fn el_arbol_muestra_las_carpetas_vacias_pero_no_las_que_solo_tienen_otros_archivos() {
        let camara = std::env::temp_dir().join(format!("ant-arbol-{}", std::process::id()));
        for carpeta in ["Vacia", "Imagenes", "Libro"] {
            fs::create_dir_all(camara.join(carpeta)).unwrap();
        }
        fs::write(camara.join("Vacia/.DS_Store"), "").unwrap();
        fs::write(camara.join("Imagenes/mapa.png"), "").unwrap();
        fs::write(camara.join("Libro/01.md"), "").unwrap();
        let nombres: Vec<String> = leer_arbol(&camara, 0).into_iter().map(|entrada| entrada.nombre).collect();
        assert_eq!(nombres, vec!["Libro", "Vacia"]);
        fs::remove_dir_all(&camara).unwrap();
    }

    #[test]
    fn manda_es_carpeta_en_camel_case() {
        let entrada = EntradaDelArbol { nombre: "a".into(), ruta: "/a".into(), es_carpeta: true, hijos: Vec::new() };
        assert!(serde_json::to_string(&entrada).unwrap().contains("\"esCarpeta\":true"));
    }
}
