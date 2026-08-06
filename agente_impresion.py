#!/usr/bin/env python3
# ================================================================
# AGENTE LOCAL DE IMPRESIÓN — Windows y Linux
# ================================================================
# Qué hace: corre en la PC del cliente, escucha en localhost, y
# cuando recibe una petición HTTP POST con bytes ESC/POS (ya
# armados por tu backend en PHP), los envía a la impresora usando
# el mecanismo nativo del sistema operativo.
#
# Este script NO genera contenido de tickets ni entiende ESC/POS:
# solo reenvía los bytes tal cual se los pasen. Toda la lógica de
# formato del ticket sigue viviendo en tu PHP.
#
# Requisitos:
#   - Python 3.8+ (viene preinstalado en la mayoría de distros Linux;
#     en Windows hay que instalarlo desde python.org)
#   - En Windows: pip install pywin32
#   - En Linux: tener CUPS instalado (comando "lp" disponible) y la
#     impresora agregada como cola RAW (ver notas al final)
# ================================================================

import http.server
import socketserver
import platform
import subprocess
import json
import base64
import sys
from datetime import datetime

# ----------------------------------------------------------------
# SECCIÓN 1 — CONFIGURACIÓN
# ----------------------------------------------------------------

# Puerto donde escucha el agente. Debe coincidir con el que uses
# en el fetch() del navegador. Evita puertos comunes ya ocupados.
PUERTO = 9100

# Nombre de la impresora tal como aparece en el sistema operativo.
# - En Windows: el nombre exacto que ves en "Impresoras y escáneres".
# - En Linux: el nombre de la cola CUPS (revisa con "lpstat -p").
# Déjalo vacío ("") para usar la impresora predeterminada del sistema,
# o mándalo por request (ver payload esperado más abajo) si manejas
# varias impresoras y quieres elegir desde PHP/JS.
IMPRESORA_POR_DEFECTO = ""

# CONFIGURAR: lista blanca de orígenes permitidos a imprimir.
# Como el agente escucha en localhost, CUALQUIER página web que el
# usuario visite podría intentar llamarlo si no se restringe. Pon
# aquí el/los dominios exactos de tu app (con https://, sin barra final).
ORIGENES_PERMITIDOS = [
    #"https://tu-dominio-ejemplo.com",
     "http://localhost:8000",  # descomenta solo si pruebas en local
]

# ----------------------------------------------------------------
# SECCIÓN 2 — IMPRESIÓN SEGÚN SISTEMA OPERATIVO
# ----------------------------------------------------------------

def imprimir(printer_name, raw_bytes):
    """Devuelve (exito: bool, mensaje: str)"""
    sistema = platform.system()
    nombre = printer_name or IMPRESORA_POR_DEFECTO
    if sistema == "Windows":
        return _imprimir_windows(nombre, raw_bytes)
    elif sistema == "Linux":
        return _imprimir_linux(nombre, raw_bytes)
    elif sistema == "Darwin":
        return _imprimir_linux(nombre, raw_bytes)  # macOS también usa CUPS/"lp"
    else:
        return False, f"Sistema operativo no soportado: {sistema}"


def _imprimir_windows(printer_name, raw_bytes):
    try:
        import win32print
    except ImportError:
        return False, "Falta pywin32. Instala con: pip install pywin32"

    try:
        nombre = printer_name or win32print.GetDefaultPrinter()
        hprinter = win32print.OpenPrinter(nombre)
        try:
            # Datatype "RAW" es clave: le dice al spooler que NO
            # reinterprete los bytes, los mande tal cual a la impresora.
            hjob = win32print.StartDocPrinter(hprinter, 1, ("Ticket ESC/POS", None, "RAW"))
            try:
                win32print.StartPagePrinter(hprinter)
                win32print.WritePrinter(hprinter, raw_bytes)
                win32print.EndPagePrinter(hprinter)
            finally:
                win32print.EndDocPrinter(hprinter)
        finally:
            win32print.ClosePrinter(hprinter)
        return True, f"Impreso en '{nombre}' ({len(raw_bytes)} bytes)"
    except Exception as e:
        return False, f"Error de impresión en Windows: {e}"


def _imprimir_linux(printer_name, raw_bytes):
    # CONFIGURAR: la impresora debe estar agregada en CUPS como cola
    # RAW (para que no intente reprocesar los comandos ESC/POS como
    # texto plano). Ejemplo de alta desde terminal:
    #   sudo lpadmin -p NOMBRE_COLA -E -v usb://EPSON/TM-T20II -m raw
    # o desde la interfaz web de CUPS: http://localhost:631
    try:
        comando = ["lp"]
        if printer_name:
            comando += ["-d", printer_name]
        comando += ["-o", "raw"]

        proc = subprocess.run(comando, input=raw_bytes, capture_output=True)
        if proc.returncode == 0:
            return True, f"Impreso ({len(raw_bytes)} bytes). {proc.stdout.decode(errors='ignore').strip()}"
        else:
            return False, f"Error de 'lp': {proc.stderr.decode(errors='ignore').strip()}"
    except FileNotFoundError:
        return False, "Comando 'lp' no encontrado. Instala CUPS: sudo pacman -S cups (o apt install cups)"


# ----------------------------------------------------------------
# SECCIÓN 3 — SERVIDOR HTTP LOCAL
# ----------------------------------------------------------------

def log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")


class ManejadorImpresion(http.server.BaseHTTPRequestHandler):

    def log_message(self, format, *args):
        pass  # silenciamos el log por defecto, usamos el nuestro

    def _origen_valido(self):
        origen = self.headers.get("Origin", "")
        return origen in ORIGENES_PERMITIDOS

    def _cors_headers(self):
        origen = self.headers.get("Origin", "")
        if origen in ORIGENES_PERMITIDOS:
            self.send_header("Access-Control-Allow-Origin", origen)
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors_headers()
        self.end_headers()

    def do_GET(self):
        # Endpoint simple para probar que el agente está vivo:
        # GET http://127.0.0.1:9100/status
        if self.path == "/status":
            self.send_response(200)
            self._cors_headers()
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            info = {"ok": True, "sistema": platform.system(), "impresora_default": IMPRESORA_POR_DEFECTO}
            self.wfile.write(json.dumps(info).encode())
        else:
            self.send_response(404)
            self._cors_headers()
            self.end_headers()

    def do_POST(self):
        if self.path != "/print":
            self.send_response(404)
            self._cors_headers()
            self.end_headers()
            return

        if not self._origen_valido():
            log(f"Rechazado: origen no autorizado ({self.headers.get('Origin')})")
            self.send_response(403)
            self._cors_headers()
            self.end_headers()
            self.wfile.write(b'{"ok": false, "message": "Origen no autorizado"}')
            return

        try:
            largo = int(self.headers.get("Content-Length", 0))
            cuerpo = self.rfile.read(largo)
            payload = json.loads(cuerpo)

            datos_b64 = payload["data"]  # bytes ESC/POS codificados en base64 (armados por PHP)
            impresora = payload.get("printer", "")
            raw_bytes = base64.b64decode(datos_b64)

            exito, mensaje = imprimir(impresora, raw_bytes)
            log(mensaje)

            self.send_response(200 if exito else 500)
            self._cors_headers()
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": exito, "message": mensaje}).encode())

        except Exception as e:
            log(f"Error procesando petición: {e}")
            self.send_response(500)
            self._cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({"ok": False, "message": str(e)}).encode())


# ----------------------------------------------------------------
# PUNTO DE ENTRADA
# ----------------------------------------------------------------
if __name__ == "__main__":
    if not ORIGENES_PERMITIDOS:
        print("ADVERTENCIA: ORIGENES_PERMITIDOS está vacío, todas las peticiones serán rechazadas.")
        print("Edita la SECCIÓN 1 de este archivo y agrega tu dominio.\n")

    with socketserver.TCPServer(("127.0.0.1", PUERTO), ManejadorImpresion) as httpd:
        print(f"Agente de impresión activo en http://127.0.0.1:{PUERTO}")
        print(f"Sistema detectado: {platform.system()}")
        print("Presiona Ctrl+C para detener.\n")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nAgente detenido.")
            sys.exit(0)
