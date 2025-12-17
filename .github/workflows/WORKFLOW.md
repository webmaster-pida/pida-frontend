📘 Guía de Flujo de Trabajo: PIDA Frontend
Entorno: GitHub Codespaces + Vite + Firebase Hosting
Ramas: development (Trabajo) y main (Producción)
1. Inicio de Sesión (Cómo empezar)
Siempre que vayas a trabajar en el proyecto:
Abre tu repositorio en GitHub.
Ve a la pestaña Codespaces.
Abre tu Codespace (o crea uno nuevo).
🚨 VERIFICACIÓN VITAL: Mira la esquina inferior izquierda de VS Code.
Debe decir: development.
Si dice main, ejecuta inmediatamente en la terminal:
code
Bash
git checkout development
2. El Ciclo Diario (Desarrollo)
Todo el trabajo de edición, experimentos y correcciones se hace aquí.
A. Para ver cambios en tiempo real (mientras programas):
Si quieres ver tus cambios al instante sin subir nada a internet:
Ejecuta en la terminal: npm run dev
Abre el link que te da Codespaces (localhost).
Para detenerlo, presiona Ctrl + C en la terminal.
B. Guardar cambios en la nube:
Cuando termines una tarea o al final del día:
code
Bash
git add .
git commit -m "Descripción breve de lo que hiciste"
git push
¿Qué sucede?
Tu código se guarda en la rama development.
GitHub Actions genera una URL de Previsualización (Preview Channel).
NO se afecta el sitio web oficial.
3. Despliegue a Producción (Publicar)
Realiza este paso SOLO cuando estés 100% seguro de que los cambios en development están listos para el público.
Ejecuta esta secuencia de comandos exacta:
code
Bash
# 1. Cambiar a la rama principal
git checkout main

# 2. (Opcional pero recomendado) Asegurar que main esté actualizado
git pull origin main

# 3. Traer (fusionar) lo que hiciste en desarrollo
git merge development

# 4. Enviar a la nube (Esto dispara la actualización "EN VIVO")
git push origin main

# 5. Regresar inmediatamente a tu zona de trabajo
git checkout development
¿Qué sucede?
GitHub detecta el cambio en main.
Ejecuta npm run build (aquí se minifica el HTML/JS/CSS).
Sube los archivos a Firebase Hosting (Canal Live).
4. Referencia Rápida de Comandos
Acción	Comando
Cambiar a desarrollo	git checkout development
Ver estado de archivos	git status
Guardar cambios	git add . <br> git commit -m "mensaje"
Subir a GitHub	git push
Verificar compilación	npm run build (Revisa la carpeta dist)
⚠️ Reglas de Oro
Nunca trabajes directamente en main. Si te das cuenta de que estás en main, cámbiate a development antes de hacer commits.
El archivo dist es automático. No intentes editar archivos dentro de la carpeta dist, se sobrescriben automáticamente.
HTML Minificado. Recuerda que en producción el HTML será ilegible ("feo") por seguridad y velocidad. Si necesitas depurar, usa la rama development o el modo npm run dev.