# Manual de instalación — Agente de impresión de tickets

Esta guía te explica, paso a paso, cómo dejar funcionando el programa que permite
imprimir tickets desde la aplicación web en tu impresora térmica. No necesitas
experiencia previa: sigue los pasos en orden y copia los comandos exactamente
como aparecen.

---

## ¿Qué es el "agente de impresión"?

Es un pequeño programa (`agente_impresion.py`) que se instala **una sola vez**
en la computadora donde está conectada la impresora térmica. Mientras está
abierto, "escucha" en segundo plano y, cuando la aplicación web le pide
imprimir un ticket, él se encarga de enviarlo a la impresora.

No necesitas entender cómo funciona por dentro — solo necesitas dejarlo
instalado y andando.

---

## Glosario rápido (términos que vas a ver en esta guía)

| Término | Qué significa |
|---|---|
| **Terminal** (o "consola", "línea de comandos") | Una ventana donde se escriben comandos de texto en vez de hacer clic. En Windows se llama "Símbolo del sistema" o "PowerShell"; en Mac y Linux se llama "Terminal". |
| **Comando** | Una instrucción de texto que escribes en la terminal y ejecutas presionando Enter. |
| **Ruta / carpeta** | El lugar del disco donde guardaste un archivo, ej. `C:\agente-impresion`. |
| **Servicio** | Un programa que corre en segundo plano, sin ventana visible, normalmente todo el tiempo que la computadora está encendida. |
| **CUPS** | El sistema que usan Linux y macOS para manejar impresoras. Windows no lo usa. |
| **Puerto** | Un número que identifica "por dónde" se comunican dos programas en la misma computadora. En esta guía usamos el puerto `9100`. |

---

## Antes de empezar

Necesitas:

1. La impresora térmica **conectada por USB y encendida**.
2. El archivo `agente_impresion.py` guardado en una carpeta fácil de recordar (en los ejemplos usaremos `agente-impresion`).
3. Permisos de administrador en la computadora (te va a pedir la contraseña en algún momento).
4. Unos 15-20 minutos.

Elige la sección según tu sistema operativo:

- [Parte 1 — Windows](#parte-1--windows)
- [Parte 2 — Linux](#parte-2--linux)
- [Parte 3 — macOS](#parte-3--macos)
- [Parte 4 — Solución de problemas](#parte-4--solución-de-problemas-comunes)

---

## Parte 1 — Windows

### 1.1 Instalar Python

1. Ve a **[python.org/downloads](https://www.python.org/downloads/)** y descarga la última versión para Windows.
2. Abre el instalador descargado.
3. **Muy importante:** en la primera pantalla, marca la casilla que dice
   **"Add python.exe to PATH"** (abajo del todo) antes de continuar.
4. Haz clic en **"Install Now"** y espera a que termine.
5. Para confirmar que se instaló bien, abre el **Símbolo del sistema**
   (busca "cmd" en el menú Inicio) y escribe:

   ```
   python --version
   ```

   Si te responde con algo como `Python 3.12.4`, quedó instalado correctamente.

### 1.2 Instalar la librería necesaria

En la misma ventana del Símbolo del sistema, escribe:

```
pip install pywin32
```

Espera a que termine (puede tardar un minuto).

### 1.3 Guardar el archivo del agente

1. Crea una carpeta, por ejemplo `C:\agente-impresion`.
2. Copia ahí el archivo `agente_impresion.py`.

### 1.4 Configurar el agente

1. Haz clic derecho sobre `agente_impresion.py` → **Abrir con** → **Bloc de notas**.
2. Busca esta sección cerca del principio del archivo (usa Ctrl+F y busca "SECCIÓN 1"):

   ```python
   ORIGENES_PERMITIDOS = [
       "https://tu-dominio-ejemplo.com",
   ]
   ```

3. Reemplaza `"https://tu-dominio-ejemplo.com"` por la dirección real de tu
   aplicación web (te la debe indicar quien te dio este manual). Debe quedar
   exactamente igual, incluyendo `https://` y sin la barra `/` al final.
4. Si tu impresora ya tiene un nombre específico en Windows y quieres fijarlo,
   busca `IMPRESORA_POR_DEFECTO = ""` y escribe el nombre entre las comillas.
   Si lo dejas vacío, usará la impresora predeterminada del sistema.
5. Guarda el archivo (Ctrl+S) y ciérralo.

### 1.5 Verificar que la impresora esté instalada en Windows

1. Abre **Configuración** → **Bluetooth y dispositivos** → **Impresoras y escáneres**.
2. Confirma que tu impresora térmica aparece en la lista. Si no aparece,
   conéctala por USB y espera unos segundos; Windows normalmente la detecta
   sola. Si no, usa **"Agregar dispositivo"**.
3. Anota el nombre exacto tal como aparece ahí — lo necesitarás si decides
   escribirlo en `IMPRESORA_POR_DEFECTO`.

### 1.6 Ejecutar el agente

1. Abre el Símbolo del sistema.
2. Escribe (ajusta la ruta si usaste otra carpeta):

   ```
   cd C:\agente-impresion
   python agente_impresion.py
   ```

3. Deberías ver un mensaje como:

   ```
   Agente de impresión activo en http://127.0.0.1:9100
   Sistema detectado: Windows
   Presiona Ctrl+C para detener.
   ```

   **Deja esta ventana abierta** — si la cierras, el agente se apaga.

### 1.7 Probar que funciona

Abre tu navegador (Chrome o Edge) y entra a:

```
http://127.0.0.1:9100/status
```

Si ves un texto como `{"ok": true, "sistema": "Windows", ...}`, el agente está
funcionando correctamente.

### 1.8 Hacer que se inicie solo (opcional, recomendado)

Para no tener que abrir la terminal manualmente cada vez que enciendas la
computadora:

1. En la carpeta `C:\agente-impresion`, crea un archivo nuevo de texto y
   nómbralo `iniciar-agente.bat` (asegúrate de que la extensión sea `.bat` y
   no `.txt`; si no ves las extensiones de archivo, actívalas desde
   **Explorador de archivos → Vista → Mostrar → Extensiones de nombre de archivo**).
2. Edita ese archivo con el Bloc de notas y pega esto dentro:

   ```bat
   @echo off
   cd /d C:\agente-impresion
   python agente_impresion.py
   pause
   ```

3. Guarda y cierra.
4. Presiona `Windows + R`, escribe `shell:startup` y presiona Enter — se abre
   la carpeta de inicio de Windows.
5. Copia ahí un **acceso directo** al archivo `iniciar-agente.bat` (clic
   derecho sobre el `.bat` → **Enviar a** → **Escritorio (crear acceso
   directo)**, y luego mueve ese acceso directo a la carpeta que se abrió).

Desde ahora, cada vez que inicies sesión en Windows, se abrirá automáticamente
una ventana con el agente corriendo.

---

## Parte 2 — Linux

Los comandos siguientes funcionan igual en Ubuntu/Debian y en Arch/CachyOS,
salvo el paso de instalación de paquetes, que se indica para ambos casos.

### 2.1 Verificar Python

Casi todas las distribuciones de Linux ya traen Python instalado. Confírmalo
abriendo una **Terminal** y escribiendo:

```bash
python3 --version
```

Si responde con algo como `Python 3.12.4`, ya lo tienes. Si dice "comando no
encontrado":

- **Arch / CachyOS:** `sudo pacman -S python`
- **Ubuntu / Debian:** `sudo apt install python3`

### 2.2 Instalar CUPS (el sistema de impresión)

- **Arch / CachyOS:**
  ```bash
  sudo pacman -S cups
  ```
- **Ubuntu / Debian:**
  ```bash
  sudo apt install cups
  ```

### 2.3 Iniciar el servicio de impresión

En muchas distros, especialmente las basadas en Arch, CUPS **no arranca
automáticamente** después de instalarlo. Actívalo con:

```bash
sudo systemctl enable --now cups.service
```

Confirma que quedó activo:

```bash
lpstat -r
```

Debe responder: `scheduler is running`. Si no, revisa la sección de
[solución de problemas](#el-servicio-cups-no-arranca-bad-file-descriptor).

### 2.4 Agregar la impresora como cola "raw"

Este paso es importante: le dice a Linux que **no** intente reinterpretar lo
que le mandes, sino que lo envíe a la impresora tal cual.

1. Con la impresora conectada por USB, busca su dirección exacta:

   ```bash
   lpinfo -v | grep -i usb
   ```

   Vas a ver una línea parecida a:
   ```
   direct usb://EPSON/TM-T20II?serial=544336460441690000
   ```

2. Copia esa dirección completa y úsala en este comando (cambia `TICKET`
   por el nombre que quieras darle a la impresora — sin espacios ni tildes):

   ```bash
   sudo lpadmin -p TICKET -E -v "usb://EPSON/TM-T20II?serial=544336460441690000" -m raw
   ```

3. Verifica que quedó creada:

   ```bash
   lpstat -p TICKET
   ```

### 2.5 Guardar y configurar el agente

1. Crea una carpeta, por ejemplo:
   ```bash
   mkdir -p ~/agente-impresion
   ```
2. Copia ahí el archivo `agente_impresion.py`.
3. Ábrelo con un editor de texto (por ejemplo `nano`):
   ```bash
   nano ~/agente-impresion/agente_impresion.py
   ```
4. Busca la sección `ORIGENES_PERMITIDOS` y reemplaza el ejemplo por la
   dirección real de tu aplicación web:
   ```python
   ORIGENES_PERMITIDOS = [
       "https://tu-dominio-ejemplo.com",
   ]
   ```
5. Busca `IMPRESORA_POR_DEFECTO = ""` y escribe el nombre que le pusiste en
   el paso 2.4 (en el ejemplo, `"TICKET"`).
6. Guarda con `Ctrl+O`, Enter, y sal con `Ctrl+X`.

### 2.6 Ejecutar el agente

```bash
cd ~/agente-impresion
python3 agente_impresion.py
```

Deberías ver:

```
Agente de impresión activo en http://127.0.0.1:9100
Sistema detectado: Linux
```

Deja esa terminal abierta, o sigue al siguiente paso para que corra solo.

### 2.7 Probar que funciona

Abre el navegador y entra a `http://127.0.0.1:9100/status`, o desde otra
terminal:

```bash
curl http://127.0.0.1:9100/status
```

Debería devolver algo como `{"ok": true, "sistema": "Linux", ...}`.

### 2.8 Hacer que se inicie solo (opcional, recomendado)

1. Crea la carpeta de servicios de usuario:
   ```bash
   mkdir -p ~/.config/systemd/user
   ```
2. Crea el archivo del servicio:
   ```bash
   nano ~/.config/systemd/user/agente-impresion.service
   ```
3. Pega esto (reemplaza `usuario` por tu nombre de usuario real, y ajusta la
   ruta si guardaste el archivo en otro lugar):

   ```ini
   [Unit]
   Description=Agente de impresion de tickets

   [Service]
   ExecStart=/usr/bin/python3 /home/usuario/agente-impresion/agente_impresion.py
   Restart=on-failure

   [Install]
   WantedBy=default.target
   ```

4. Guarda y sal (`Ctrl+O`, Enter, `Ctrl+X`).
5. Activa el servicio:

   ```bash
   systemctl --user daemon-reload
   systemctl --user enable --now agente-impresion.service
   ```

6. Verifica que quedó corriendo:

   ```bash
   systemctl --user status agente-impresion.service
   ```

Desde ahora, el agente arranca solo cada vez que inicias sesión.

---

## Parte 3 — macOS

### 3.1 Verificar Python

macOS trae Python instalado de fábrica, pero conviene confirmar la versión.
Abre la app **Terminal** (búscala con Spotlight, `Cmd + Espacio`) y escribe:

```bash
python3 --version
```

Si no lo tienes o quieres la versión más reciente, instala
[Homebrew](https://brew.sh) primero y luego:

```bash
brew install python3
```

### 3.2 CUPS ya viene incluido

macOS usa CUPS igual que Linux, y ya viene activo por defecto. Confírmalo con:

```bash
lpstat -r
```

Debe responder `scheduler is running`. Si no, revisa la sección de
[solución de problemas](#el-servicio-cups-no-arranca-bad-file-descriptor).

### 3.3 Agregar la impresora como cola "raw"

1. Con la impresora conectada y encendida, busca su dirección:
   ```bash
   lpinfo -v | grep -i usb
   ```
2. Copia la dirección que aparece y úsala aquí (cambia `TICKET` por el nombre
   que prefieras):
   ```bash
   sudo lpadmin -p TICKET -E -v "usb://EPSON/TM-T20II?serial=544336460441690000" -m raw
   ```
3. Verifica:
   ```bash
   lpstat -p TICKET
   ```

### 3.4 Guardar y configurar el agente

1. Crea una carpeta:
   ```bash
   mkdir -p ~/agente-impresion
   ```
2. Copia ahí `agente_impresion.py`.
3. Ábrelo con un editor de texto simple, por ejemplo:
   ```bash
   nano ~/agente-impresion/agente_impresion.py
   ```
4. Igual que en Linux, ajusta `ORIGENES_PERMITIDOS` con el dominio real de tu
   app, y `IMPRESORA_POR_DEFECTO` con el nombre que usaste en 3.3.
5. Guarda con `Ctrl+O`, Enter, `Ctrl+X`.

### 3.5 Ejecutar el agente

```bash
cd ~/agente-impresion
python3 agente_impresion.py
```

### 3.6 Probar que funciona

Abre el navegador en `http://127.0.0.1:9100/status`, o desde otra Terminal:

```bash
curl http://127.0.0.1:9100/status
```

### 3.7 Hacer que se inicie solo (opcional, recomendado)

1. Crea el archivo de configuración:
   ```bash
   nano ~/Library/LaunchAgents/com.ticket.agente.plist
   ```
2. Pega esto (reemplaza `TU_USUARIO` por tu nombre de usuario real de macOS,
   visible en la ruta de tu carpeta de inicio):

   ```xml
   <?xml version="1.0" encoding="UTF-8"?>
   <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
   <plist version="1.0">
   <dict>
       <key>Label</key>
       <string>com.ticket.agente</string>
       <key>ProgramArguments</key>
       <array>
           <string>/usr/bin/python3</string>
           <string>/Users/TU_USUARIO/agente-impresion/agente_impresion.py</string>
       </array>
       <key>RunAtLoad</key>
       <true/>
       <key>KeepAlive</key>
       <true/>
   </dict>
   </plist>
   ```

3. Guarda y sal.
4. Actívalo:
   ```bash
   launchctl load ~/Library/LaunchAgents/com.ticket.agente.plist
   ```

Desde ahora, el agente arranca solo con cada inicio de sesión.

---

## Parte 4 — Solución de problemas comunes

### "No se pudo contactar al agente local"

Este mensaje aparece en la página web cuando prueba conectarse al agente.
Revisa en orden:

1. **¿La ventana del agente sigue abierta?** Si la cerraste, el agente se
   apagó. Vuelve a ejecutarlo.
2. **¿El dominio está bien escrito en `ORIGENES_PERMITIDOS`?** Debe coincidir
   exactamente, incluyendo `https://` (o `http://` si es una prueba local) y
   sin barra `/` al final. Para confirmar el valor exacto: abre las
   Herramientas de desarrollador del navegador (tecla `F12`) → pestaña
   **Network** → busca la petición a `/status` que falló → pestaña
   **Headers** → copia el valor del encabezado `Origin`. Ese texto exacto va
   en `ORIGENES_PERMITIDOS`.
3. **Después de editar el archivo, ¿reiniciaste el agente?** Los cambios no
   se aplican solos: cierra la ventana (`Ctrl+C`) y vuelve a ejecutar
   `python agente_impresion.py`.
4. **El navegador pidió permiso de "acceder a la red local" y no lo
   aceptaste.** Es normal que aparezca esa ventana la primera vez —
   acéptala.

### El servicio CUPS no arranca ("Bad file descriptor")

Este error (en español "Descriptor de fichero erróneo") en Linux o macOS
significa que el servicio de impresión no está corriendo.

```bash
sudo systemctl enable --now cups.service
lpstat -r
```

Si sigue fallando, revisa el detalle del error:

```bash
journalctl -xeu cups.service --no-pager | tail -30
```

Si el archivo de configuración quedó dañado, restaura el original:

```bash
sudo cp /usr/share/cups/cupsd.conf.default /etc/cups/cupsd.conf
sudo systemctl restart cups.service
```

### En Windows, aparece "Falta pywin32"

Abre el Símbolo del sistema y ejecuta:

```
pip install pywin32
```

### El ticket se imprime, pero sale como texto raro o no corta el papel

Es casi siempre porque la impresora **no** quedó configurada como cola "raw".
Repite el paso de agregar la impresora (2.4 en Linux, 3.3 en macOS) y
confirma con `lpstat -p NOMBRE` que use el driver `raw` y no uno específico
de la marca.

### No sé qué nombre exacto tiene mi impresora

- **Windows:** Configuración → Impresoras y escáneres → copia el nombre tal
  cual aparece en la lista.
- **Linux / macOS:**
  ```bash
  lpstat -p
  ```
  Muestra todas las colas configuradas con su nombre exacto.

### Quiero detener el agente

Si lo tienes corriendo en una ventana visible, simplemente presiona `Ctrl+C`
en esa ventana.

Si lo configuraste para iniciar solo:

- **Windows:** quita el acceso directo de la carpeta de inicio
  (`Windows + R` → `shell:startup`).
- **Linux:**
  ```bash
  systemctl --user disable --now agente-impresion.service
  ```
- **macOS:**
  ```bash
  launchctl unload ~/Library/LaunchAgents/com.ticket.agente.plist
  ```

---

## ¿Todo funcionando?

Si `http://127.0.0.1:9100/status` te responde `"ok": true`, el agente está
listo. El siguiente paso es abrir la aplicación web, hacer clic en
"Verificar conexión" (o el botón equivalente) y luego probar una impresión
de prueba.
