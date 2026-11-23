// Английские строки геопортала: интерфейс, подписи манифеста (scripts/geodata/build_geodata.py) и повторяющиеся
// значения полей (классы поверхности, сообщества, зоны, состояние домов). Собственные названия (улицы, скверы,
// адреса) остаются как в данных. Ключ: русский текст. Числа, которые меняются от сборки к сборке, в ключе
// заменены на {}: «Детская площадка № {}», и подставляются из исходной строки в английском формате.
// Именованные места {n} заполняет вызывающий код через G(текст, {n: ...}).
import { EN } from '../lib/strings-en';
import { currentLang } from '../lib/i18n';

export const GEO_EN = {
  // шапка, панель, подложки
  'на сайт проекта': 'to the project site',
  'Геопортал': 'Geoportal',
  'Геопортал. OilGasCity': 'Geoportal. OilGasCity',
  'Город': 'Town',
  'Слои': 'Layers',
  'Скрыть слои': 'Hide layers',
  'Слои карты': 'Map layers',
  'О картах': 'About the maps',
  'Тема карты': 'Map theme',
  'Подложка': 'Basemap',
  'Схема': 'Map',
  'Снимок Esri': 'Esri imagery',
  'Снимки © Esri, Maxar, Earthstar Geographics': 'Imagery © Esri, Maxar, Earthstar Geographics',
  'Данные: проект РНФ № 25-27-00022': 'Data: RSF project No. 25-27-00022',
  'Ширина панели слоёв': 'Layer panel width',
  'Потяните, чтобы изменить ширину панели': 'Drag to change the panel width',
  'Не удалось загрузить данные геопортала. Попробуйте обновить страницу.': 'The geoportal data could not be loaded. Please reload the page.',
  'Пояснение': 'Explanation',
  'О группе «{t}»': 'About the group "{t}"',
  'О слое «{t}»': 'About the layer "{t}"',
  'Таблица слоя «{t}»': 'Table of the layer "{t}"',
  'Атрибутивная таблица': 'Attribute table',
  'Показаны дома: {f}.': 'Buildings shown: {f}.',
  'Показать все': 'Show all',
  'Источник:': 'Source:',
  'Страница города': 'Town page',
  'карты в материалах': 'maps in the materials',

  // скачивание
  'Скачать слой': 'Download layer',
  '{n} объектов, исходная геометрия, UTM 43N.': '{n} features, original geometry, UTM 43N.',
  'Лицензия': 'Licence',
  'Ссылка:': 'Cite as:',
  'МБ': 'MB',
  'КБ': 'KB',

  // фото
  '{t}, снимок {i}': '{t}, photo {i}',
  '{i} из {n}': '{i} of {n}',
  'Предыдущий снимок': 'Previous photo',
  'Следующий снимок': 'Next photo',
  'Закрыть': 'Close',
  'Фото: {t}': 'Photos: {t}',
  '1 фото': '1 photo',
  '{} фото': '{} photos',
  'Закрыть фото': 'Close photos',
  'Прокрутить назад': 'Scroll back',
  'Прокрутить вперёд': 'Scroll forward',
  'Открыть снимок {i}': 'Open photo {i}',
  'Фото: {n}, лента внизу карты': 'Photos: {n}, strip at the bottom of the map',
  '{i} из {n} в этом месте: щёлкните ещё раз, чтобы показать следующий': '{i} of {n} at this spot: click again to show the next one',
  'июль {}': 'July {}',
  'Детская площадка {}': 'Playground {}',
  'Детская площадка № {}': 'Playground No. {}',
  'Спортивная площадка {}': 'Sports ground {}',
  'Парк {}': 'Park {}',
  'Сквер {}': 'Square {}',
  'Стадион {}': 'Stadium {}',
  'Геоботаническое описание № {}': 'Geobotanical relevé No. {}',
  'Геоботаническое описание КВ_{}': 'Geobotanical relevé КВ_{}',
  'Точка экологической напряжённости № {}': 'Environmental stress point No. {}',
  'Точка экологической напряжённости КЭ_{}': 'Environmental stress point КЭ_{}',

  // снимки проекта
  'Снимки проекта': 'Project imagery',
  'О снимках': 'About the imagery',
  'Исходные многоканальные сцены и съёмка с беспилотника. Снимок ложится под слои карты.':
    'Original multispectral scenes and UAV survey. The image is placed under the map layers.',
  ' Выбран: {t}, разрешение {r}.': ' Selected: {t}, resolution {r}.',
  'Снимок': 'Image',
  'Без снимка': 'No image',
  'Оговорка о качестве снимка': 'Image quality caveat',
  'Цветовой синтез': 'Colour composite',
  'Что показывает синтез': 'What the composite shows',
  'Снимок виден при более крупном масштабе: приблизьте карту.': 'The image is visible at a larger scale: zoom in.',
  'Непрозрачность': 'Opacity',
  'Только снимок, без слоёв карты': 'Image only, without map layers',
  'Близко к тому, что видит глаз.': 'Close to what the eye sees.',
  'Растительность красная: чем ярче, тем она гуще и активнее.': 'Vegetation is red: the brighter, the denser and more active it is.',
  'Красный край: различия в состоянии растительности, в том числе газонов и крон.':
    'Red edge: differences in vegetation condition, including lawns and tree crowns.',
  'Беспилотник, июль 2025': 'UAV, July 2025',
  'Беспилотник, июль 2025: NDVI': 'UAV, July 2025: NDVI',
  'Беспилотник, июль 2025: ортофото': 'UAV, July 2025: orthophoto',
  'Беспилотник, июль 2025: цифровая модель местности': 'UAV, July 2025: digital surface model', // uav-dsm в imagery.py
  'Сверхвысокое разрешение': 'Very high resolution',
  'Естественные цвета': 'Natural colour',
  'Ложные цвета: ближний ИК': 'False colour: near infrared',
  'Красный край': 'Red edge',
  'Съёмка с беспилотника, проект РНФ № 25-27-00022': 'UAV survey, RSF project No. 25-27-00022',
  'около {} м': 'about {} m',
  '{} м': '{} m',
  'На участке «городок» часть кадров снята сквозь дымку: белёсые пятна скрывают землю. Это дефект съёмки, а не обработки.':
    'At the "Gorodok" site some frames were taken through haze: whitish patches hide the ground. This is a survey defect, not a processing one.',
  'На участке «городок» под пятнами дымки на ортофото NDVI занижен (около нуля), там значения недостоверны.':
    'At the "Gorodok" site NDVI is underestimated (close to zero) under the haze patches on the orthophoto; the values there are unreliable.',

  // жилой фонд: график и факты
  'О графике': 'About the chart',
  'Щелчок по столбцу показывает дома этого десятилетия.': 'Click a bar to show the buildings of that decade.',
  '{l}: {v} тыс. м², 1 дом': '{l}: {v} thousand m², 1 building',
  '{l}: {v} тыс. м², {n} дом': '{l}: {v} thousand m², {n} buildings',
  '{l}: {v} тыс. м², {n} дома': '{l}: {v} thousand m², {n} buildings',
  '{l}: {v} тыс. м², {n} домов': '{l}: {v} thousand m², {n} buildings',
  'Когда строился город': 'When the town was built',
  'тыс. м² жилой площади': 'thousand m² of living area',
  '{} тыс. м²': '{} thousand m²', // единица не разрывается при переносе
  'действующих жилых домов в реестре ГИС ЖКХ': 'residential buildings currently listed in the GIS ZhKH register',
  'домов на карте с контуром здания': 'buildings mapped with an outline',
  'многоквартирных домов': 'apartment buildings',
  'известной жилой площади': 'of known living area',
  'Жилая площадь домов действующего реестра по десятилетиям постройки, всего {} тыс. м². Домов без года постройки: {}, их известная площадь {} тыс. м².':
    'Living area of the buildings in the current register by decade of construction, {} thousand m² in total. Buildings without a construction year: {}, their known area {} thousand m².',
  'до {}': 'before {}',
  '{}-е': '{}s',
  'нет данных': 'no data',

  // атрибутивная таблица
  'Ширина колонки «{t}»': 'Width of the column "{t}"',
  'Потяните, чтобы изменить ширину; двойной щелчок вернёт ширину по содержимому': 'Drag to change the width; double-click to fit the content',
  '{n} объектов': '{n} features',
  '{a} из {b}': '{a} of {b}',
  'загрузка…': 'loading…',
  'Атрибутивная таблица слоя «{t}»': 'Attribute table of the layer "{t}"',
  'Высота таблицы': 'Table height',
  'Потяните, чтобы изменить высоту таблицы': 'Drag to change the table height',
  'Поиск по таблице': 'Search the table',
  'только в окне карты': 'only within the map view',
  'Приблизить к выбранному объекту': 'Zoom to the selected feature',
  'К выбранному': 'Zoom to selected',
  'Развернуть таблицу': 'Expand the table',
  'Свернуть таблицу': 'Collapse the table',
  'Развернуть': 'Expand',
  'Свернуть': 'Collapse',
  'Закрыть таблицу': 'Close the table',
  'Загрузка таблицы…': 'Loading the table…',
  'Нет строк.': 'No rows.',
  'Нет строк по этому запросу.': 'No rows match this search.',
  'Номер объекта в слое': 'Feature number in the layer',
  '№': 'No.',
  '№ в слое': 'No. in layer',

  // поля
  'Тип': 'Type',
  'Площадь, га': 'Area, ha',
  'Площадь, м²': 'Area, m²',
  'Адрес': 'Address',
  'Этажей': 'Storeys',
  'Квартир': 'Apartments',
  'Подъездов': 'Entrances',
  'Год постройки': 'Year built',
  'Состояние': 'Condition',
  'Тип дома': 'Building type',
  'Жителей (оценка)': 'Residents (estimate)',
  'Формация': 'Formation',
  'Сообщество': 'Community',
  'Зона': 'Zone',
  'Жилая площадь, м²': 'Living area, m²',
  'Контур': 'Outline',
  'Источник контура': 'Outline source',
  'Описание': 'Description',
  'Название': 'Name',
  'Фото': 'Photos',
  'Десятилетие': 'Decade',
  'Долгота': 'Longitude',
  'Широта': 'Latitude',
  'Класс': 'Class',
  'Группа': 'Group',
  'Микрорайон': 'Microdistrict',
  'OSM ID здания': 'OSM building ID',

  // города и вкладки
  'Ямало-Ненецкий автономный округ': 'Yamal-Nenets Autonomous Okrug',
  'Ханты-Мансийский автономный округ (Югра)': 'Khanty-Mansi Autonomous Okrug (Yugra)',
  'Зелёная инфраструктура': 'Green infrastructure',
  'Жилой фонд': 'Housing stock',
  'Карты повторяют рисунки статьи о зелёной инфраструктуре города и отчёта за 2025 год.':
    "The maps reproduce the figures from the paper on the town's green infrastructure and from the 2025 report.",
  'Слои по той же методике, что и для Муравленко. Статья о зелёной инфраструктуре Когалыма готовится к выходу.':
    "The layers follow the same method as for Muravlenko. A paper on Kogalym's green infrastructure is in preparation.",
  'Возраст жилых домов по реестру ГИС ЖКХ. Цвет показывает десятилетие постройки, по щелчку видны адрес, этажность, квартиры и жилая площадь.':
    'Age of residential buildings from the GIS ZhKH register (the state housing and utilities information system). Colour shows the decade of construction; click a building to see its address, number of storeys, apartments and living area.',
  'ГИС ЖКХ (реестр и карточки домов на 23.10.2026), кадастровые контуры зданий НСПД, вспомогательные контуры OSM':
    'GIS ZhKH (register and building records as of 23 October 2026), cadastral building outlines from NSPD (National Spatial Data System), auxiliary outlines from OSM',
  'Миляев И.А., Сизов О.С., Федоров Р.Ю., Скрицкая М.К. Региональные геосистемы, 2025, № 3':
    'Milyaev I.A., Sizov O.S., Fedorov R.Yu., Skritskaya M.K. Regional Geosystems, 2025, No. 3',
  'Данные проекта РНФ № 25-27-00022, полевые работы 2026 года': 'RSF project No. 25-27-00022 data, fieldwork 2026',

  // группы и слои
  'Обзорная карта': 'Overview map',
  'По рис. 1 статьи': 'After Fig. 1 of the paper',
  'Граница, улицы': 'Boundary, streets',
  'Граница города': 'Town boundary',
  'Микрорайоны': 'Microdistricts',
  'Улицы': 'Streets',
  'Парки и скверы: названия': 'Parks and squares: names',
  'Типы поверхности': 'Land cover types',
  'Типы поверхности и NDVI': 'Land cover types and NDVI',
  'По рис. 4a статьи: снимок WorldView-2, 17.07.2020': 'After Fig. 4a of the paper: WorldView-2 image, 17 July 2020',
  'Снимок GeoEye-1, 08.07.2020; публикуются только производные': 'GeoEye-1 image, 8 July 2020; only derived products are published',
  'Классификация типов поверхности': 'Land cover classification',
  'Вегетационный индекс NDVI': 'NDVI vegetation index',
  'Растительность': 'Vegetation',
  'Геоботаническая карта, отчёт 2025, результат 3': 'Vegetation map, 2025 report, result 3',
  'Растительные сообщества': 'Plant communities',
  'Открытые пространства и доступность': 'Open spaces and accessibility',
  'По рис. 6 статьи и результату 7 отчёта': 'After Fig. 6 of the paper and result 7 of the report',
  'Парки, скверы и площадки': 'Parks, squares, playgrounds and sports grounds',
  'Парки, скверы и площадки, обследованные в 2026 году': 'Parks, squares, playgrounds and sports grounds surveyed in 2026',
  'Парки и скверы': 'Parks and squares',
  'Детские и спортивные площадки': 'Playgrounds and sports grounds',
  'Открытое пространство': 'Open space',
  '{} м пешком от парков и скверов': 'Within a {} m walk of parks and squares',
  'Буфер построен для геопортала по методике статьи': 'The buffer was built for the geoportal using the method of the paper',
  'Полевые работы 2025': 'Fieldwork 2025',
  'Полевые работы 2026': 'Fieldwork 2026',
  'Точки из полевых дневников и навигатора, июль 2025': 'Points from field notebooks and a GPS receiver, July 2025',
  'Точки привязаны по GPS': 'Points located by GPS',
  'Точки описаний': 'Survey points',
  'У точек с фото по щелчку внизу карты открывается лента снимков': 'Click a point with photos to open a photo strip at the bottom of the map',
  'Геоботаническое описание': 'Geobotanical relevé',
  'Точка экологической напряжённости': 'Environmental stress point',
  'Застройка и зонирование': 'Buildings and zoning',
  'Застройка': 'Buildings',
  'Данные проекта': 'Project data',
  'Функциональные зоны': 'Functional zones',
  'Жилые дома': 'Residential buildings',
  'Жилые дома с оценкой числа жителей': 'Residential buildings with an estimated number of residents',
  'Возраст домов': 'Building age',
  'Жилые дома по десятилетию постройки': 'Residential buildings by decade of construction',
  'Год постройки по карточкам ГИС ЖКХ': 'Year built from GIS ZhKH building records',
  'Дома по источнику контура': 'Buildings by outline source',
  'Как дом из реестра связан с контуром здания': 'How a register entry was matched to a building outline',

  // легенды NDVI и классы поверхности
  '-{} и ниже': '-{} and below',
  '{} и ниже: без растительности': '{} and below: no vegetation',
  '{} и выше: густая растительность': '{} and above: dense vegetation',
  'Хвойные породы': 'Coniferous trees',
  'Лиственные породы': 'Deciduous trees',
  'Кустарники и газоны': 'Shrubs and lawns',
  'Оголённые пески': 'Bare sand',
  'Водоёмы': 'Water bodies',
  'Болота': 'Wetlands',
  'Благоустроенные открытые пространства': 'Landscaped open spaces',
  'Жилые здания': 'Residential buildings',
  'Нежилые здания': 'Non-residential buildings',
  'Здания и сооружения': 'Buildings and structures',
  'Дороги': 'Roads',
  'Тени': 'Shadows',

  // растительность: формации и сообщества
  'Разнотравные сообщества': 'Forb communities',
  'Разнотравные сообщества со смешанным подростом': 'Forb communities with mixed tree regrowth',
  'Разнотравные сообщества с разреженным смешанным подростом (сосна, ива, береза)':
    'Forb communities with sparse mixed tree regrowth (pine, willow, birch)',
  'Лиственные лесные сообщества': 'Deciduous forest communities',
  'Светлохвойные лесные сообщества': 'Light-coniferous forest communities',
  'Смешанные лесные сообщества': 'Mixed forest communities',
  'Болотные кустарничковые сообщества': 'Mire dwarf-shrub communities',
  'Сосновые лесные сообщества': 'Pine forest communities',
  'Березово-ивовые с участием осины лесные сообщества': 'Birch-willow forest communities with aspen',
  'Сосново-березово-ивовые лесные сообщества': 'Pine-birch-willow forest communities',
  'Березовые лесные сообщества': 'Birch forest communities',
  'Березово-сосновые лесные сообщества': 'Birch-pine forest communities',
  'Березовые и березово-осиновые лесные сообщества': 'Birch and birch-aspen forest communities',
  'Сосново-ерниковые болотные сообщества': 'Pine and dwarf-birch mire communities',
  'Березово-ивовые лесные сообщества': 'Birch-willow forest communities',
  'Сосново-березовые лесные сообщества': 'Pine-birch forest communities',
  'Лиственно-плодовые лесные сообщества (береза, рябина, черемуха, яблоня)':
    'Deciduous and fruit-tree forest communities (birch, rowan, bird cherry, apple)',
  'Березово-ивовые с примесью ели лесные сообщества': 'Birch-willow forest communities with an admixture of spruce',
  'Сосново-ивовые лесные сообщества': 'Pine-willow forest communities',
  'Елово-березовые лесные сообщества': 'Spruce-birch forest communities',
  'Сосновые и сосново-елово-ивовые лесные сообщества': 'Pine and pine-spruce-willow forest communities',

  // функциональные зоны
  'Жилая зона': 'Residential zone',
  'Общественно-деловая зона': 'Public and business zone',
  'Зона рекреационного назначения': 'Recreational zone',
  'Зона производственного использования': 'Industrial zone',
  'Зона специального назначения': 'Special-purpose zone',
  'Зона инженерной и транспортной инфраструктуры': 'Utilities and transport infrastructure zone',
  'Зона сельскохозяйственного использования': 'Agricultural zone',

  // открытые пространства и точки
  'детская площадка': 'playground',
  'спортивная площадка': 'sports ground',
  'парк': 'park',
  'сквер': 'square',
  'стадион': 'stadium',
  'площадка для собак': 'dog park',
  'лыжный склон': 'ski slope',
  'лыжная база': 'ski centre',
  'верёвочный парк': 'ropes course',
  'площадка': 'playground or sports ground',
  'зелёная зона': 'green area',
  'Площадка': 'Playground',
  'Спорт': 'Sports ground',
  'Сквер': 'Square',
  'Собаки': 'Dog park',
  'геоботаническое описание': 'geobotanical relevé',
  'точка экологической напряжённости': 'environmental stress point',
  '{} м пешком': '{} m walk',

  // жилые дома: значения полей
  'Исправный': 'Good condition',
  'Ветхий': 'Dilapidated',
  'Аварийный': 'Unsafe',
  'Строительство': 'Under construction',
  'Многоквартирный': 'Apartment building',
  'Жилой': 'House',
  'НСПД, по кадастровому номеру': 'NSPD, by cadastral number',
  'НСПД, по адресу и общей площади': 'NSPD, by address and total floor area',
  'НСПД, кандидат: совпали адрес, площадь и этажность': 'NSPD, candidate: address, floor area and storeys match',
  'OSM, вспомогательный контур по адресу': 'OSM, auxiliary outline by address',
  'НСПД, по кадастровому номеру: {}': 'NSPD, by cadastral number: {}',
  'НСПД, по адресу и общей площади: {}': 'NSPD, by address and total floor area: {}',
  'НСПД, кандидат: совпали адрес, площадь и этажность: {}': 'NSPD, candidate: address, floor area and storeys match: {}',
  'OSM, вспомогательный контур по адресу: {}': 'OSM, auxiliary outline by address: {}',

  // лицензии и ссылки на данные
  '© участники OpenStreetMap': '© OpenStreetMap contributors',
  'Миляев И.А., Сизов О.С., Федоров Р.Ю., Скрицкая М.К. Оценка обеспеченности зеленой инфраструктурой жителей северного нефтегазового города (г. Муравленко, ЯНАО) // Региональные геосистемы. 2025. № 3. Данные проекта РНФ № 25-27-00022. URL: https://oilgascity.ru/geoportal':
    'Milyaev I.A., Sizov O.S., Fedorov R.Yu., Skritskaya M.K. Assessment of green infrastructure provision for residents of a northern oil and gas town (Muravlenko, Yamal-Nenets Autonomous Okrug). Regional Geosystems, 2025, No. 3. RSF project No. 25-27-00022 data. URL: https://oilgascity.ru/geoportal',
  'Данные проекта РНФ № 25-27-00022, геоботаническая карта Муравленко, 2025. URL: https://oilgascity.ru/geoportal':
    'RSF project No. 25-27-00022 data, vegetation map of Muravlenko, 2025. URL: https://oilgascity.ru/geoportal',
  'Данные проекта РНФ № 25-27-00022, открытые пространства Когалыма, 2026; © участники OpenStreetMap. URL: https://oilgascity.ru/geoportal':
    'RSF project No. 25-27-00022 data, open spaces of Kogalym, 2026; © OpenStreetMap contributors. URL: https://oilgascity.ru/geoportal',
  'Данные проекта РНФ № 25-27-00022, типы поверхности Когалыма; © участники OpenStreetMap. URL: https://oilgascity.ru/geoportal':
    'RSF project No. 25-27-00022 data, land cover types of Kogalym; © OpenStreetMap contributors. URL: https://oilgascity.ru/geoportal',
};

const CYR = /[А-Яа-яЁё№]/; // знак номера тоже переводится: № -> No.
const NUM = /\d+(?:[\s,]\d+)*/g; // \s ловит и неразрывные пробелы из toLocaleString
// число из русской записи в английскую: 491,9 -> 491.9, 1 041 -> 1,041
const enNum = (n) => n.replace(',', '.').replace(/\s/g, ',');
const cache = new Map();

function lookup(s) {
  const hit = GEO_EN[s] ?? EN[s];
  if (hit !== undefined) return hit;
  const nums = s.match(NUM);
  const tpl = nums && GEO_EN[s.replace(NUM, '{}')];
  if (!tpl) return s;
  let k = 0;
  return tpl.replace(/\{\}/g, () => enNum(nums[k++] ?? ''));
}

// Строка геопортала на языке страницы; без перевода остаётся русской
export function geoTr(lang, s) {
  if (lang !== 'en' || typeof s !== 'string') return s;
  if (!CYR.test(s)) return /^-?\d+,\d+$/.test(s) ? s.replace(',', '.') : s; // подписи шкал: 0,4
  if (!cache.has(s)) cache.set(s, lookup(s));
  return cache.get(s);
}

// То же по адресу страницы (/en/geoportal), с подстановкой именованных мест: G('{n} фото', {n: 5})
export function G(s, vars) {
  let out = geoTr(currentLang(), s);
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, v);
  return out;
}
