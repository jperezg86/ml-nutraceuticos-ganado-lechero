#!/usr/bin/env python3
"""
Genera manual de usuario MetanoML — Equipo 48 Tec de Monterrey
Tamaño carta, colores Tec (azul #003B71, oro #C8A951, blanco)
"""
import os
from pathlib import Path
from reportlab.lib.pagesizes import LETTER
from reportlab.lib import colors
from reportlab.lib.units import inch, cm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Image, PageBreak,
    Table, TableStyle, HRFlowable, KeepTogether,
)
from reportlab.platypus import ListFlowable, ListItem
from reportlab.lib.utils import ImageReader
from PIL import Image as PILImage
import textwrap

# ── Colores Tec de Monterrey ──────────────────────────────────────────────────
TEC_AZUL    = colors.HexColor('#003B71')
TEC_AZUL_MED= colors.HexColor('#1B5EA7')
TEC_ORO     = colors.HexColor('#C8A951')
TEC_GRIS    = colors.HexColor('#6C757D')
TEC_GRIS_LT = colors.HexColor('#F4F6F9')
TEC_BLANCO  = colors.white
VERDE       = colors.HexColor('#1A8A5A')
AMARILLO    = colors.HexColor('#D4930A')
ROJO        = colors.HexColor('#C0392B')

# ── Paths ─────────────────────────────────────────────────────────────────────
HERE = Path(__file__).parent
OUT  = HERE / 'MetanoML_Manual_Usuario.pdf'

# ── Helpers ───────────────────────────────────────────────────────────────────
W, H = LETTER   # 612 x 792 pt

def img(name, width_in=6.5, max_h_in=4.0):
    p = HERE / name
    if not p.exists():
        return Spacer(1, 0.2*inch)
    # calcular alto proporcional
    pi = PILImage.open(p)
    pw, ph = pi.size
    ratio = ph / pw
    w = width_in * inch
    h = min(ratio * w, max_h_in * inch)
    return Image(str(p), width=w, height=h)

def caption(text):
    return Paragraph(f'<i><font color="#6C757D" size="8">{text}</font></i>',
                     ParagraphStyle('cap', alignment=TA_CENTER))

def section_header(text, story, styles):
    story.append(Spacer(1, 0.25*inch))
    story.append(HRFlowable(width='100%', thickness=3, color=TEC_AZUL, spaceAfter=4))
    story.append(Paragraph(text, styles['h2']))
    story.append(Spacer(1, 0.1*inch))

# ── Estilos ───────────────────────────────────────────────────────────────────
def build_styles():
    s = getSampleStyleSheet()
    custom = {
        'h1': ParagraphStyle('h1', fontName='Helvetica-Bold', fontSize=22,
                             textColor=TEC_BLANCO, spaceAfter=6, leading=28),
        'h1sub': ParagraphStyle('h1sub', fontName='Helvetica', fontSize=12,
                                textColor=TEC_ORO, spaceAfter=4, leading=16),
        'h2': ParagraphStyle('h2', fontName='Helvetica-Bold', fontSize=14,
                             textColor=TEC_AZUL, spaceAfter=4, leading=18),
        'h3': ParagraphStyle('h3', fontName='Helvetica-Bold', fontSize=11,
                             textColor=TEC_AZUL_MED, spaceAfter=4, spaceBefore=8, leading=14),
        'body': ParagraphStyle('body', fontName='Helvetica', fontSize=10,
                               textColor=colors.HexColor('#1A1A1A'), leading=15,
                               spaceAfter=6, alignment=TA_JUSTIFY),
        'bullet': ParagraphStyle('bullet', fontName='Helvetica', fontSize=10,
                                 textColor=colors.HexColor('#1A1A1A'), leading=14,
                                 leftIndent=16, spaceAfter=3),
        'caption': ParagraphStyle('caption', fontName='Helvetica-Oblique', fontSize=8,
                                  textColor=TEC_GRIS, alignment=TA_CENTER, spaceAfter=8),
        'badge_verde': ParagraphStyle('bv', fontName='Helvetica-Bold', fontSize=9,
                                      textColor=VERDE),
        'badge_amarillo': ParagraphStyle('ba', fontName='Helvetica-Bold', fontSize=9,
                                         textColor=AMARILLO),
        'badge_rojo': ParagraphStyle('br', fontName='Helvetica-Bold', fontSize=9,
                                     textColor=ROJO),
        'note': ParagraphStyle('note', fontName='Helvetica-Oblique', fontSize=9,
                               textColor=TEC_GRIS, leftIndent=12, rightIndent=12,
                               borderPad=6, backColor=TEC_GRIS_LT),
    }
    return custom

# ── Encabezado y pie de página ────────────────────────────────────────────────
def on_page(canvas, doc):
    canvas.saveState()
    # Header bar
    canvas.setFillColor(TEC_AZUL)
    canvas.rect(0, H - 0.45*inch, W, 0.45*inch, fill=1, stroke=0)
    canvas.setFillColor(TEC_ORO)
    canvas.setFont('Helvetica-Bold', 8)
    canvas.drawString(0.5*inch, H - 0.29*inch, 'MetanoML · Sistema de Predicción de Metano Entérico')
    canvas.setFillColor(TEC_BLANCO)
    canvas.setFont('Helvetica', 8)
    canvas.drawRightString(W - 0.5*inch, H - 0.29*inch, 'Equipo 48 · Tec de Monterrey')

    # Footer bar
    canvas.setFillColor(TEC_AZUL)
    canvas.rect(0, 0, W, 0.38*inch, fill=1, stroke=0)
    canvas.setFillColor(TEC_BLANCO)
    canvas.setFont('Helvetica', 8)
    canvas.drawString(0.5*inch, 0.14*inch, 'Manual de Usuario · 2025')
    canvas.drawRightString(W - 0.5*inch, 0.14*inch, f'Página {doc.page}')
    canvas.restoreState()

def on_first_page(canvas, doc):
    # Sin header/footer en portada
    pass

# ── Portada ───────────────────────────────────────────────────────────────────
def build_cover(story, styles):
    # Fondo azul completo
    story.append(Spacer(1, 1.4*inch))

    # Bloque azul superior
    cover_title_style = ParagraphStyle('ct', fontName='Helvetica-Bold', fontSize=32,
                                       textColor=TEC_BLANCO, leading=38, alignment=TA_CENTER)
    cover_sub_style   = ParagraphStyle('cs', fontName='Helvetica', fontSize=14,
                                       textColor=TEC_ORO, leading=20, alignment=TA_CENTER)
    cover_sub2_style  = ParagraphStyle('cs2', fontName='Helvetica', fontSize=11,
                                       textColor=TEC_BLANCO, leading=16, alignment=TA_CENTER)

    # Banner azul con título
    data = [
        [Paragraph('🐄 MetanoML', cover_title_style)],
        [Paragraph('Sistema de Predicción de Metano Entérico', cover_sub_style)],
        [Spacer(1, 0.15*inch)],
        [Paragraph('Manual de Usuario', ParagraphStyle('mu', fontName='Helvetica-Bold',
                   fontSize=18, textColor=TEC_ORO, alignment=TA_CENTER))],
    ]
    t = Table(data, colWidths=[6.5*inch])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), TEC_AZUL),
        ('TOPPADDING',    (0,0), (-1,-1), 18),
        ('BOTTOMPADDING', (0,0), (-1,-1), 18),
        ('LEFTPADDING',   (0,0), (-1,-1), 24),
        ('RIGHTPADDING',  (0,0), (-1,-1), 24),
        ('ROUNDEDCORNERS', [12]),
    ]))
    story.append(t)
    story.append(Spacer(1, 0.35*inch))

    # Screenshot del dashboard como preview
    story.append(img('01_dashboard.png', width_in=6.3, max_h_in=3.5))
    story.append(Spacer(1, 0.3*inch))

    # Info pie portada
    info_style = ParagraphStyle('info', fontName='Helvetica', fontSize=10,
                                textColor=TEC_GRIS, alignment=TA_CENTER, leading=16)
    story.append(Paragraph('Equipo 48 · Ingeniería en Tecnologías Computacionales', info_style))
    story.append(Paragraph('Tecnológico de Monterrey · 2025', info_style))
    story.append(PageBreak())

# ── Tabla de contenido ────────────────────────────────────────────────────────
def build_toc(story, styles):
    story.append(Spacer(1, 0.2*inch))
    story.append(Paragraph('Contenido', styles['h2']))
    story.append(HRFlowable(width='100%', thickness=2, color=TEC_ORO, spaceAfter=12))

    toc_items = [
        ('1.', 'Introducción al sistema'),
        ('2.', 'Acceder a la aplicación'),
        ('3.', 'Resumen del Hato — Dashboard'),
        ('4.', 'Registrar una Visita'),
        ('   4.1', 'Datos de la vaca y del ambiente'),
        ('   4.2', 'Composición de la dieta'),
        ('   4.3', 'Nutraceuticos y suplementos'),
        ('   4.4', 'Interpretar la predicción'),
        ('5.', 'Explorar el Hato'),
        ('   5.1', 'Perfil individual de la vaca'),
        ('   5.2', 'Cruce de variables'),
        ('6.', 'Estado del Modelo'),
        ('7.', 'Niveles de emisión y alertas'),
        ('8.', 'Glosario de términos'),
    ]

    toc_style = ParagraphStyle('toc', fontName='Helvetica', fontSize=10,
                               textColor=colors.HexColor('#1A1A1A'), leading=18)
    toc_bold  = ParagraphStyle('tocb', fontName='Helvetica-Bold', fontSize=10,
                               textColor=TEC_AZUL, leading=18)

    for num, title in toc_items:
        bold = not num.startswith(' ')
        sty  = toc_bold if bold else toc_style
        dot_line = '.' * max(2, 60 - len(num) - len(title))
        story.append(Paragraph(f'{num}&nbsp;&nbsp;{title}', sty))

    story.append(PageBreak())

# ── Sección 1: Introducción ───────────────────────────────────────────────────
def build_intro(story, styles):
    section_header('1. Introducción al sistema', story, styles)
    story.append(Paragraph(
        'MetanoML es una aplicación local que permite al equipo de campo registrar visitas de vacas '
        'lecheras, estimar automáticamente la emisión de metano entérico y dar seguimiento al hato '
        'a lo largo del tiempo. Todo funciona sin necesidad de internet: los datos se guardan en '
        'una base de datos local en tu computadora.',
        styles['body']))
    story.append(Spacer(1, 0.1*inch))

    # Tabla de módulos
    data = [
        [Paragraph('<b>Pantalla</b>', styles['body']),
         Paragraph('<b>¿Para qué sirve?</b>', styles['body'])],
        [Paragraph('📊 Resumen del Hato', styles['body']),
         Paragraph('Vista general: KPIs, alertas, tendencia histórica de metano y comparativa por raza.', styles['body'])],
        [Paragraph('✏️ Registrar Visita', styles['body']),
         Paragraph('Ingresar datos de una visita, obtener predicción automática y guardar en la base de datos.', styles['body'])],
        [Paragraph('🔍 Explorar Hato', styles['body']),
         Paragraph('Buscar vacas individualmente, ver su historial, cruzar variables y comparar razas.', styles['body'])],
        [Paragraph('📡 Estado del Modelo', styles['body']),
         Paragraph('Verificar si el hato ha cambiado (drift) y qué tan preciso sigue siendo el modelo de IA.', styles['body'])],
    ]
    t = Table(data, colWidths=[1.8*inch, 4.7*inch])
    t.setStyle(TableStyle([
        ('BACKGROUND',    (0,0), (-1,0), TEC_AZUL),
        ('TEXTCOLOR',     (0,0), (-1,0), TEC_BLANCO),
        ('FONTNAME',      (0,0), (-1,0), 'Helvetica-Bold'),
        ('BACKGROUND',    (0,1), (-1,-1), TEC_BLANCO),
        ('BACKGROUND',    (0,2), (-1,2), TEC_GRIS_LT),
        ('BACKGROUND',    (0,4), (-1,4), TEC_GRIS_LT),
        ('ROWBACKGROUNDS',(0,1), (-1,-1), [TEC_BLANCO, TEC_GRIS_LT]),
        ('GRID',          (0,0), (-1,-1), 0.5, colors.HexColor('#DEE2E6')),
        ('TOPPADDING',    (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('LEFTPADDING',   (0,0), (-1,-1), 10),
        ('VALIGN',        (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(t)
    story.append(Spacer(1, 0.2*inch))

    story.append(Paragraph(
        '<b>Modelo de inteligencia artificial:</b> Red neuronal MLP (Multi-Layer Perceptron) '
        'entrenada con 73,000 registros de 100 vacas durante 24 meses. '
        'RMSE = 0.711 g CH₄/kg leche · R² = 0.967.',
        styles['body']))

# ── Sección 2: Acceso ─────────────────────────────────────────────────────────
def build_acceso(story, styles):
    section_header('2. Acceder a la aplicación', story, styles)
    story.append(Paragraph(
        'La aplicación corre localmente en tu computadora. Para abrirla, sigue estos pasos:',
        styles['body']))

    steps = [
        'Abre una terminal y navega a la carpeta del proyecto.',
        'Ejecuta el servidor backend: <font name="Courier" size="9">cd app/backend &amp;&amp; node server.js</font>',
        'En otra terminal, ejecuta el frontend: <font name="Courier" size="9">cd app/frontend &amp;&amp; npm run dev</font>',
        'Abre tu navegador en: <font color="#1B5EA7"><b>http://localhost:3000</b></font>',
    ]
    for i, step in enumerate(steps, 1):
        story.append(Paragraph(f'<b>{i}.</b> {step}', styles['bullet']))
    story.append(Spacer(1, 0.1*inch))

    note_style = ParagraphStyle('note2', fontName='Helvetica-Oblique', fontSize=9,
                                textColor=TEC_GRIS, leftIndent=0, backColor=TEC_GRIS_LT,
                                borderPad=8, leading=14)
    story.append(Paragraph(
        '💡 <b>Tip:</b> Si el servidor ya está corriendo (alguien más lo inició), '
        'basta con abrir el navegador en http://localhost:3000.',
        note_style))

# ── Sección 3: Dashboard ──────────────────────────────────────────────────────
def build_dashboard(story, styles):
    section_header('3. Resumen del Hato — Dashboard', story, styles)
    story.append(Paragraph(
        'Es la primera pantalla que ves al abrir la aplicación. Muestra una vista panorámica '
        'del estado del hato con los datos históricos.',
        styles['body']))
    story.append(Spacer(1, 0.1*inch))
    story.append(img('01_dashboard.png', 6.5, 4.2))
    story.append(caption('Figura 1 — Pantalla de Resumen del Hato'))
    story.append(Spacer(1, 0.1*inch))

    data = [
        [Paragraph('<b>Indicador</b>', styles['body']),
         Paragraph('<b>Descripción</b>', styles['body'])],
        [Paragraph('Total registros', styles['body']),
         Paragraph('Número total de visitas guardadas en la base de datos.', styles['body'])],
        [Paragraph('Vacas únicas', styles['body']),
         Paragraph('Cantidad de vacas distintas con al menos un registro.', styles['body'])],
        [Paragraph('Metano medio', styles['body']),
         Paragraph('Promedio de g CH₄/kg leche del hato. Verde (<18) · Amarillo (18-25) · Rojo (>25)', styles['body'])],
        [Paragraph('Leche media', styles['body']),
         Paragraph('Producción promedio diaria por vaca en kg/día.', styles['body'])],
        [Paragraph('Alertas totales', styles['body']),
         Paragraph('Vacas con emisión alta (>25 g CH₄/kg leche) detectadas.', styles['body'])],
    ]
    t = Table(data, colWidths=[1.6*inch, 4.9*inch])
    t.setStyle(TableStyle([
        ('BACKGROUND',    (0,0), (-1,0), TEC_AZUL),
        ('TEXTCOLOR',     (0,0), (-1,0), TEC_BLANCO),
        ('ROWBACKGROUNDS',(0,1), (-1,-1), [TEC_BLANCO, TEC_GRIS_LT]),
        ('GRID',          (0,0), (-1,-1), 0.5, colors.HexColor('#DEE2E6')),
        ('TOPPADDING',    (0,0), (-1,-1), 7),
        ('BOTTOMPADDING', (0,0), (-1,-1), 7),
        ('LEFTPADDING',   (0,0), (-1,-1), 10),
        ('VALIGN',        (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(t)

# ── Sección 4: Registrar Visita ───────────────────────────────────────────────
def build_registrar(story, styles):
    section_header('4. Registrar una Visita', story, styles)
    story.append(Paragraph(
        'Esta es la pantalla principal de operación. Ingresa los datos de la visita de una vaca '
        'y el sistema calculará automáticamente la predicción de metano al guardar.',
        styles['body']))
    story.append(Spacer(1, 0.1*inch))
    story.append(img('02_registrar.png', 6.5, 4.0))
    story.append(caption('Figura 2 — Formulario de Registrar Visita'))

    story.append(Paragraph('4.1 Datos de la vaca y del ambiente', styles['h3']))
    story.append(Paragraph(
        'Primero ingresa el <b>ID de la vaca</b> (ej. V-042) y la <b>fecha de visita</b>. '
        'Luego completa los parámetros de producción:',
        styles['body']))
    campos = [
        ('Leche kg/día', 'Producción de leche del día de la visita.'),
        ('Consumo MS kg', 'Kilogramos de materia seca consumida por día.'),
        ('FCR', 'Feed Conversion Ratio = consumo MS ÷ leche producida.'),
        ('Peso kg', 'Peso corporal de la vaca.'),
        ('Edad (meses)', 'Edad actual de la vaca en meses.'),
        ('N° lactancia', 'Número de lactancias completadas.'),
        ('THI', 'Índice de temperatura-humedad. ≥72 indica estrés térmico.'),
        ('Humedad %', 'Porcentaje de humedad relativa ambiental.'),
        ('Sistema producción', 'Extensivo, Semi-intensivo o Intensivo.'),
    ]
    for campo, desc in campos:
        story.append(Paragraph(f'• <b>{campo}:</b> {desc}', styles['bullet']))
    story.append(Spacer(1, 0.08*inch))

    story.append(Paragraph('4.2 Composición de la dieta', styles['h3']))
    for campo, desc in [
        ('Fibra %', 'Porcentaje de fibra en la dieta total.'),
        ('Proteína dieta %', 'Porcentaje de proteína cruda en la dieta.'),
        ('Energía MCal/kg MS', 'Densidad energética de la dieta (valor típico: 3.8).'),
    ]:
        story.append(Paragraph(f'• <b>{campo}:</b> {desc}', styles['bullet']))

    story.append(Paragraph('4.3 Nutraceuticos y suplementos', styles['h3']))
    story.append(img('06_form_bottom.png', 6.5, 3.2))
    story.append(caption('Figura 3 — Sección de nutraceuticos y panel de variables calculadas'))
    story.append(Spacer(1, 0.08*inch))
    for campo, desc in [
        ('Omega-3 mg/L', 'Dosis de omega-3 en la leche producida (0 si no se suplementa).'),
        ('Antioxidantes ppm', 'Partes por millón de antioxidantes en la dieta.'),
        ('Taninos', 'Activar si la vaca recibe suplemento de taninos.'),
        ('Algas', 'Activar si la vaca recibe suplemento de algas marinas.'),
    ]:
        story.append(Paragraph(f'• <b>{campo}:</b> {desc}', styles['bullet']))

    story.append(Paragraph('4.4 Interpretar la predicción', styles['h3']))
    story.append(Paragraph(
        'Al presionar <b>Guardar y predecir</b>, el sistema calcula automáticamente las '
        'variables derivadas y ejecuta el modelo. El resultado aparece con un color según '
        'el nivel de emisión:',
        styles['body']))

    nivel_data = [
        [Paragraph('<b>Nivel</b>', styles['body']),
         Paragraph('<b>Rango</b>', styles['body']),
         Paragraph('<b>Acción recomendada</b>', styles['body'])],
        [Paragraph('🟢 Bajo', styles['body']),
         Paragraph('< 18 g CH₄/kg leche', styles['body']),
         Paragraph('Emisión dentro de rango óptimo. Mantener manejo actual.', styles['body'])],
        [Paragraph('🟡 Medio', styles['body']),
         Paragraph('18–25 g CH₄/kg leche', styles['body']),
         Paragraph('Emisión moderada. Revisar dieta y condición corporal.', styles['body'])],
        [Paragraph('🔴 Alto', styles['body']),
         Paragraph('> 25 g CH₄/kg leche', styles['body']),
         Paragraph('Emisión elevada. Intervención recomendada: ajustar fibra/proteína o añadir suplemento.', styles['body'])],
    ]
    t = Table(nivel_data, colWidths=[1.2*inch, 1.8*inch, 3.5*inch])
    t.setStyle(TableStyle([
        ('BACKGROUND',    (0,0), (-1,0), TEC_AZUL),
        ('TEXTCOLOR',     (0,0), (-1,0), TEC_BLANCO),
        ('BACKGROUND',    (0,1), (-1,1), colors.HexColor('#E8F5EE')),
        ('BACKGROUND',    (0,2), (-1,2), colors.HexColor('#FFF8E6')),
        ('BACKGROUND',    (0,3), (-1,3), colors.HexColor('#FDECEA')),
        ('GRID',          (0,0), (-1,-1), 0.5, colors.HexColor('#DEE2E6')),
        ('TOPPADDING',    (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('LEFTPADDING',   (0,0), (-1,-1), 10),
        ('VALIGN',        (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(t)
    story.append(Spacer(1, 0.1*inch))
    story.append(Paragraph(
        'Después de guardar, aparece el botón <b>🐄 Ver perfil de [ID vaca]</b>. '
        'Al hacer clic, la aplicación abre directamente el historial completo de esa vaca en el Explorador.',
        styles['body']))

# ── Sección 5: Explorar Hato ──────────────────────────────────────────────────
def build_explorar(story, styles):
    section_header('5. Explorar el Hato', story, styles)
    story.append(Paragraph(
        'El Explorador permite analizar los datos históricos de 73,000 registros. '
        'Tiene dos modos de uso:',
        styles['body']))

    story.append(Paragraph('5.1 Perfil individual de la vaca', styles['h3']))
    story.append(img('07_explorar_vacas.png', 6.5, 3.8))
    story.append(caption('Figura 4 — Búsqueda y perfil individual de vaca'))
    story.append(Spacer(1, 0.08*inch))
    story.append(Paragraph(
        'Escribe el ID de una vaca en el buscador (ej. "V-042") para ver: '
        'su tendencia de metano en el tiempo, últimas 5 visitas con fechas, '
        'nivel de emisión histórico y comparativa con el promedio del hato.',
        styles['body']))

    story.append(Paragraph('5.2 Cruce de variables', styles['h3']))
    story.append(img('08_explorar_cruce.png', 6.5, 3.8))
    story.append(caption('Figura 5 — Cruce de variables con 3 tipos de gráfica'))
    story.append(Spacer(1, 0.08*inch))
    story.append(Paragraph(
        'Selecciona cualquier par de variables para visualizar su relación. '
        'Disponible en tres modos:',
        styles['body']))
    for modo, desc in [
        ('⬡ Dispersión', 'Scatter X vs Y, puntos coloreados por nivel de emisión (Bajo/Medio/Alto).'),
        ('▬ Distribución', 'Histograma de frecuencias de la variable seleccionada.'),
        ('▨ Por Raza', 'Barras con el promedio de la variable para cada raza del hato.'),
    ]:
        story.append(Paragraph(f'• <b>{modo}:</b> {desc}', styles['bullet']))

# ── Sección 6: Monitor ────────────────────────────────────────────────────────
def build_monitor(story, styles):
    section_header('6. Estado del Modelo', story, styles)
    story.append(img('04_monitor.png', 6.5, 3.8))
    story.append(caption('Figura 6 — Estado del modelo: detección de cambios y precisión'))
    story.append(Spacer(1, 0.1*inch))
    story.append(Paragraph(
        'Esta pantalla responde dos preguntas clave para el mantenimiento del sistema:',
        styles['body']))

    for titulo, desc in [
        ('📡 ¿Cambió el hato? (Drift)',
         'Compara la distribución actual de los datos contra el histórico de entrenamiento. '
         'Si el hato cambió significativamente (nuevas razas, cambios de manejo, estación), '
         'el modelo puede necesitar reentrenamiento. El resultado se muestra en semáforo: '
         'Verde = sin cambio significativo, Amarillo = cambio moderado, Rojo = drift severo.'),
        ('🎯 ¿Qué tan preciso es?',
         'Muestra la precisión del modelo con datos reales: scatter de valores reales vs predichos '
         '(puntos sobre la diagonal = predicción perfecta) e histograma de residuos centrado en 0. '
         'RMSE = 0.711 · R² = 0.967.'),
    ]:
        story.append(Paragraph(f'<b>{titulo}</b>', styles['h3']))
        story.append(Paragraph(desc, styles['body']))

# ── Sección 7: Niveles de alerta ──────────────────────────────────────────────
def build_alertas(story, styles):
    section_header('7. Niveles de emisión y alertas', story, styles)
    story.append(Paragraph(
        'El sistema clasifica cada predicción en tres niveles usando los umbrales '
        'establecidos por el equipo de investigación:',
        styles['body']))
    story.append(Spacer(1, 0.1*inch))

    data = [
        [Paragraph('<b>Nivel</b>', styles['body']),
         Paragraph('<b>CH₄ (g/kg leche)</b>', styles['body']),
         Paragraph('<b>Significado</b>', styles['body']),
         Paragraph('<b>Acción</b>', styles['body'])],
        [Paragraph('🟢 BAJO', ParagraphStyle('n1',fontName='Helvetica-Bold',fontSize=10,textColor=VERDE)),
         Paragraph('< 18', styles['body']),
         Paragraph('Vaca eficiente. Emisión óptima para la producción.', styles['body']),
         Paragraph('Mantener manejo.', styles['body'])],
        [Paragraph('🟡 MEDIO', ParagraphStyle('n2',fontName='Helvetica-Bold',fontSize=10,textColor=AMARILLO)),
         Paragraph('18 – 25', styles['body']),
         Paragraph('Emisión moderada. Probable relación con dieta o estrés térmico.', styles['body']),
         Paragraph('Revisar THI y composición de dieta.', styles['body'])],
        [Paragraph('🔴 ALTO', ParagraphStyle('n3',fontName='Helvetica-Bold',fontSize=10,textColor=ROJO)),
         Paragraph('> 25', styles['body']),
         Paragraph('Emisión elevada. Puede indicar problema de salud, estrés o dieta inadecuada.', styles['body']),
         Paragraph('Intervención inmediata: ajustar fibra/proteína, añadir taninos o algas.', styles['body'])],
    ]
    t = Table(data, colWidths=[0.9*inch, 1.1*inch, 2.8*inch, 1.7*inch])
    t.setStyle(TableStyle([
        ('BACKGROUND',    (0,0), (-1,0), TEC_AZUL),
        ('TEXTCOLOR',     (0,0), (-1,0), TEC_BLANCO),
        ('ROWBACKGROUNDS',(0,1), (-1,-1), [colors.HexColor('#E8F5EE'), colors.HexColor('#FFF8E6'), colors.HexColor('#FDECEA')]),
        ('GRID',          (0,0), (-1,-1), 0.5, colors.HexColor('#DEE2E6')),
        ('TOPPADDING',    (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('LEFTPADDING',   (0,0), (-1,-1), 8),
        ('VALIGN',        (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(t)

# ── Sección 8: Glosario ───────────────────────────────────────────────────────
def build_glosario(story, styles):
    section_header('8. Glosario de términos', story, styles)

    terminos = [
        ('CH₄', 'Metano — gas de efecto invernadero producido por la digestión entérica del ganado.'),
        ('FCR', 'Feed Conversion Ratio — relación entre el alimento consumido y la leche producida.'),
        ('THI', 'Temperature-Humidity Index — índice que combina temperatura y humedad para estimar estrés térmico. Valor ≥72 indica estrés.'),
        ('MLP', 'Multi-Layer Perceptron — red neuronal artificial usada como modelo predictivo.'),
        ('RMSE', 'Root Mean Square Error — error cuadrático medio. Mide la precisión del modelo (menor = mejor). Nuestro modelo: 0.711 g CH₄/kg leche.'),
        ('R²', 'Coeficiente de determinación — indica cuánta variabilidad explica el modelo (1.0 = perfecto). Nuestro modelo: 0.967.'),
        ('Drift', 'Cambio en la distribución estadística de los datos del hato respecto al periodo de entrenamiento.'),
        ('Nutraceutico', 'Suplemento con propiedades nutricionales y farmacológicas (omega-3, taninos, algas) que pueden reducir la producción de metano.'),
        ('g CH₄/kg leche', 'Unidad de intensidad de emisión: gramos de metano producidos por cada kilogramo de leche.'),
        ('Lactancia', 'Ciclo productivo de la vaca. El número de lactancia indica cuántos ciclos ha completado.'),
    ]
    for term, defn in terminos:
        story.append(Paragraph(
            f'<b><font color="#003B71">{term}:</font></b> {defn}',
            styles['body']))
        story.append(Spacer(1, 0.04*inch))

# ── MAIN ──────────────────────────────────────────────────────────────────────
def main():
    doc = SimpleDocTemplate(
        str(OUT),
        pagesize=LETTER,
        leftMargin=0.85*inch,
        rightMargin=0.85*inch,
        topMargin=0.65*inch,
        bottomMargin=0.65*inch,
        title='Manual de Usuario — MetanoML',
        author='Equipo 48 · Tec de Monterrey',
        subject='Sistema de Predicción de Metano Entérico',
    )

    styles = build_styles()
    story  = []

    # Portada (sin header/footer)
    build_cover(story, styles)

    # Resto del manual (con header/footer)
    build_toc(story, styles)
    build_intro(story, styles)
    story.append(PageBreak())
    build_acceso(story, styles)
    story.append(PageBreak())
    build_dashboard(story, styles)
    story.append(PageBreak())
    build_registrar(story, styles)
    story.append(PageBreak())
    build_explorar(story, styles)
    story.append(PageBreak())
    build_monitor(story, styles)
    build_alertas(story, styles)
    story.append(PageBreak())
    build_glosario(story, styles)

    doc.build(story,
              onFirstPage=on_first_page,
              onLaterPages=on_page)

    print(f'✅ PDF generado: {OUT}')

if __name__ == '__main__':
    main()
