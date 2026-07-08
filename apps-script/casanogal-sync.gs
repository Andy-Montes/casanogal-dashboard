/**
 * Casa Nogal · Backend de sincronización (estado compartido)
 * ----------------------------------------------------------
 * Guarda en una hoja "estado" los cambios que hace la app (niños, notas,
 * objetivos, evaluaciones, etc.). La app lee todo al abrir (doGet) y escribe
 * cada cambio (doPost). Así el estado se comparte entre todos y persiste.
 *
 * INSTALACIÓN:
 *  1. Crea una Google Sheet nueva (será la base de datos de Casa Nogal).
 *  2. Extensiones → Apps Script. Borra lo que haya y pega TODO este archivo.
 *  3. Implementar → Nueva implementación → tipo "Aplicación web".
 *       - Ejecutar como: Yo
 *       - Quién tiene acceso: Cualquier usuario
 *  4. Copia la URL que termina en /exec y pásasela a Claude.
 */

var HOJA = 'estado';

function _sheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(HOJA);
  if (!sh) {
    sh = ss.insertSheet(HOJA);
    sh.appendRow(['clave', 'valor', 'actualizado']);
  }
  return sh;
}

function _json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// Lectura: devuelve todo el estado guardado como { clave: valor }
function doGet() {
  var sh = _sheet();
  var rows = sh.getDataRange().getValues();
  var estado = {};
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0]) estado[rows[i][0]] = rows[i][1];
  }
  return _json({ ok: true, estado: estado });
}

// Escritura: upsert por clave. Acepta { items: [{clave, valor}, ...] } o { clave, valor }.
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var body = JSON.parse(e.postData.contents);
    var items = body.items && body.items.length ? body.items : [{ clave: body.clave, valor: body.valor }];
    var sh = _sheet();
    var rows = sh.getDataRange().getValues();
    var ahora = new Date().toISOString();

    // índice clave -> nº de fila (1-based) para upsert rápido
    var idx = {};
    for (var i = 1; i < rows.length; i++) { if (rows[i][0]) idx[rows[i][0]] = i + 1; }

    var nuevas = [];
    for (var k = 0; k < items.length; k++) {
      var it = items[k];
      if (!it || !it.clave) continue;
      var valor = (it.valor == null) ? '' : String(it.valor);
      if (idx[it.clave]) {
        sh.getRange(idx[it.clave], 2, 1, 2).setValues([[valor, ahora]]);
      } else {
        nuevas.push([it.clave, valor, ahora]);
        idx[it.clave] = -1; // evita duplicar si viene 2 veces en el mismo lote
      }
    }
    if (nuevas.length) {
      sh.getRange(sh.getLastRow() + 1, 1, nuevas.length, 3).setValues(nuevas);
    }
    return _json({ ok: true, guardados: items.length });
  } catch (err) {
    return _json({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}
