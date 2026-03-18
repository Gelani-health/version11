/**
 * World Data for Patient Registration
 * Comprehensive data for countries, languages, nationalities, religions
 */

// ============================================
// COUNTRIES WITH ADDRESS FORMATS
// ============================================

export interface AddressFormatConfig {
  fields: AddressFieldConfig[];
  regionLabel: string;
  postalLabel: string;
}

export interface AddressFieldConfig {
  name: string;
  label: string;
  placeholder: string;
  type: 'text' | 'select';
  options?: string[];
  required?: boolean;
}

export const countries = [
  "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda",
  "Argentina", "Armenia", "Australia", "Austria", "Azerbaijan", "Bahamas", "Bahrain",
  "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bhutan",
  "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria",
  "Burkina Faso", "Burundi", "Cabo Verde", "Cambodia", "Cameroon", "Canada",
  "Central African Republic", "Chad", "Chile", "China", "Colombia", "Comoros",
  "Congo", "Congo (Democratic Republic)", "Costa Rica", "Croatia", "Cuba", "Cyprus",
  "Czech Republic", "Denmark", "Djibouti", "Dominica", "Dominican Republic",
  "East Timor", "Ecuador", "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea",
  "Estonia", "Eswatini", "Ethiopia", "Fiji", "Finland", "France", "Gabon", "Gambia",
  "Georgia", "Germany", "Ghana", "Greece", "Grenada", "Guatemala", "Guinea",
  "Guinea-Bissau", "Guyana", "Haiti", "Honduras", "Hungary", "Iceland", "India",
  "Indonesia", "Iran", "Iraq", "Ireland", "Israel", "Italy", "Ivory Coast", "Jamaica",
  "Japan", "Jordan", "Kazakhstan", "Kenya", "Kiribati", "Kosovo", "Kuwait",
  "Kyrgyzstan", "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya",
  "Liechtenstein", "Lithuania", "Luxembourg", "Madagascar", "Malawi", "Malaysia",
  "Maldives", "Mali", "Malta", "Marshall Islands", "Mauritania", "Mauritius",
  "Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco",
  "Mozambique", "Myanmar", "Namibia", "Nauru", "Nepal", "Netherlands", "New Zealand",
  "Nicaragua", "Niger", "Nigeria", "North Korea", "North Macedonia", "Norway", "Oman",
  "Pakistan", "Palau", "Palestine", "Panama", "Papua New Guinea", "Paraguay", "Peru",
  "Philippines", "Poland", "Portugal", "Qatar", "Romania", "Russia", "Rwanda",
  "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines", "Samoa",
  "San Marino", "Sao Tome and Principe", "Saudi Arabia", "Senegal", "Serbia",
  "Seychelles", "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Solomon Islands",
  "Somalia", "South Africa", "South Korea", "South Sudan", "Spain", "Sri Lanka", "Sudan",
  "Suriname", "Sweden", "Switzerland", "Syria", "Taiwan", "Tajikistan", "Tanzania",
  "Thailand", "Togo", "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey",
  "Turkmenistan", "Tuvalu", "Uganda", "Ukraine", "United Arab Emirates",
  "United Kingdom", "United States", "Uruguay", "Uzbekistan", "Vanuatu", "Vatican City",
  "Venezuela", "Vietnam", "Yemen", "Zambia", "Zimbabwe"
];

export const countriesWithCities: Record<string, string[]> = {
  "Ethiopia": ["Addis Ababa", "Dire Dawa", "Mekelle", "Gondar", "Bahir Dar", "Jimma", "Dessie", "Hawassa", "Adama", "Harar", "Jijiga", "Shashamane", "Debre Markos", "Debre Birhan", "Nekemte", "Arba Minch", "Wolisso", "Hosaena", "Kombolcha", "Sodo"],
  "United States": ["New York", "Los Angeles", "Chicago", "Houston", "Phoenix", "Philadelphia", "San Antonio", "San Diego", "Dallas", "San Jose", "Austin", "Jacksonville", "Fort Worth", "Columbus", "Charlotte", "San Francisco", "Indianapolis", "Seattle", "Denver", "Washington"],
  "United Kingdom": ["London", "Birmingham", "Manchester", "Leeds", "Glasgow", "Liverpool", "Newcastle", "Sheffield", "Bristol", "Edinburgh", "Leicester", "Coventry", "Kingston", "Belfast", "Nottingham", "Plymouth", "Southampton", "Reading", "Derby", "Wolverhampton"],
  "Canada": ["Toronto", "Montreal", "Vancouver", "Calgary", "Edmonton", "Ottawa", "Winnipeg", "Quebec City", "Hamilton", "Kitchener", "London", "Victoria", "Halifax", "Oshawa", "Windsor", "Saskatoon", "Regina", "St. John's", "Kelowna", "Barrie"],
  "Germany": ["Berlin", "Hamburg", "Munich", "Cologne", "Frankfurt", "Stuttgart", "Düsseldorf", "Dortmund", "Essen", "Leipzig", "Bremen", "Dresden", "Hanover", "Nuremberg", "Duisburg", "Bochum", "Wuppertal", "Bielefeld", "Bonn", "Münster"],
  "France": ["Paris", "Marseille", "Lyon", "Toulouse", "Nice", "Nantes", "Strasbourg", "Montpellier", "Bordeaux", "Lille", "Rennes", "Reims", "Le Havre", "Saint-Étienne", "Toulon", "Grenoble", "Dijon", "Angers", "Nîmes", "Villeurbanne"],
  "Australia": ["Sydney", "Melbourne", "Brisbane", "Perth", "Adelaide", "Canberra", "Gold Coast", "Newcastle", "Wollongong", "Logan City", "Geelong", "Hobart", "Townsville", "Cairns", "Darwin", "Toowoomba", "Ballarat", "Bendigo", "Albury", "Launceston"],
  "India": ["Mumbai", "Delhi", "Bangalore", "Chennai", "Kolkata", "Hyderabad", "Ahmedabad", "Pune", "Jaipur", "Lucknow", "Kanpur", "Nagpur", "Indore", "Thane", "Bhopal", "Visakhapatnam", "Patna", "Vadodara", "Ghaziabad", "Ludhiana"],
  "China": ["Shanghai", "Beijing", "Guangzhou", "Shenzhen", "Chengdu", "Chongqing", "Wuhan", "Xi'an", "Hangzhou", "Tianjin", "Nanjing", "Suzhou", "Qingdao", "Shenyang", "Dalian", "Xiamen", "Kunming", "Ningbo", "Fuzhou", "Harbin"],
  "Japan": ["Tokyo", "Yokohama", "Osaka", "Nagoya", "Sapporo", "Fukuoka", "Kobe", "Kyoto", "Kawasaki", "Saitama", "Hiroshima", "Sendai", "Kitakyushu", "Chiba", "Sakai", "Niigata", "Hamamatsu", "Kumamoto", "Sagamihara", "Shizuoka"],
  "Saudi Arabia": ["Riyadh", "Jeddah", "Mecca", "Medina", "Dammam", "Khobar", "Dhahran", "Tabuk", "Buraidah", "Khamis Mushait", "Abha", "Hail", "Najran", "Taif", "Jubail", "Al Hofuf", "Yanbu", "Al Khobar", "Qatif", "Dhahran"],
  "UAE": ["Dubai", "Abu Dhabi", "Sharjah", "Al Ain", "Ajman", "Ras Al Khaimah", "Fujairah", "Umm Al Quwain", "Khor Fakkan", "Kalba"],
  "Kenya": ["Nairobi", "Mombasa", "Kisumu", "Nakuru", "Eldoret", "Kisii", "Malindi", "Kitale", "Garissa", "Nyeri", "Machakos", "Thika", "Meru", "Nanyuki", "Kakamega", "Naivasha", "Malindi", "Voi", "Lamu", "Isiolo"],
  "Nigeria": ["Lagos", "Kano", "Ibadan", "Abuja", "Port Harcourt", "Kaduna", "Benin City", "Maiduguri", "Zaria", "Aba", "Jos", "Ilorin", "Oyo", "Enugu", "Onitsha", "Warri", "Sokoto", "Kano", "Calabar", "Katsina"],
  "South Africa": ["Johannesburg", "Cape Town", "Durban", "Pretoria", "Port Elizabeth", "Bloemfontein", "East London", "Pietermaritzburg", "Kimberley", "Polokwane", "George", "Nelspruit", "Rustenburg", "Vereeniging", "Soweto", "Benoni", "Boksburg", "Welkom", "East Rand", "West Rand"],
  "Brazil": ["São Paulo", "Rio de Janeiro", "Brasília", "Salvador", "Fortaleza", "Belo Horizonte", "Manaus", "Curitiba", "Recife", "Porto Alegre", "Belém", "Goiânia", "Guarulhos", "Campinas", "São Luís", "São Gonçalo", "Maceió", "Natal", "Teresina", "Campo Grande"],
  "Mexico": ["Mexico City", "Guadalajara", "Monterrey", "Puebla", "Tijuana", "León", "Ciudad Juárez", "Mérida", "Zapopan", "Monterrey", "Nezahualcóyotl", "Chihuahua", "Naucalpan", "Mérida", "San Luis Potosí", "Aguascalientes", "Hermosillo", "Saltillo", "Mexicali", "Culiacán"],
  "Spain": ["Madrid", "Barcelona", "Valencia", "Seville", "Zaragoza", "Málaga", "Bilbao", "Alicante", "Córdoba", "Valladolid", "Vigo", "Gijón", "Granada", "A Coruña", "Vitoria", "Santa Cruz", "Oviedo", "Pamplona", "Santander", "San Sebastián"],
  "Italy": ["Rome", "Milan", "Naples", "Turin", "Palermo", "Genoa", "Bologna", "Florence", "Venice", "Verona", "Messina", "Padua", "Trieste", "Brescia", "Parma", "Prato", "Modena", "Reggio Calabria", "Perugia", "Livorno"],
  "Netherlands": ["Amsterdam", "Rotterdam", "The Hague", "Utrecht", "Eindhoven", "Groningen", "Tilburg", "Almere", "Breda", "Nijmegen", "Arnhem", "Haarlem", "Zaanstad", "'s-Hertogenbosch", "Amersfoort", "Maastricht", "Dordrecht", "Leiden", "Zwolle", "Deventer"],
  "Switzerland": ["Zurich", "Geneva", "Basel", "Lausanne", "Bern", "Winterthur", "Lucerne", "St. Gallen", "Lugano", "Biel/Bienne", "Thun", "Köniz", "La Chaux-de-Fonds", "Fribourg", "Schaffhausen", "Chur", "Vernier", "Neuchâtel", "Uster", "Sion"],
  "Sweden": ["Stockholm", "Gothenburg", "Malmö", "Uppsala", "Linköping", "Örebro", "Västerås", "Helsingborg", "Norrköping", "Jönköping", "Lund", "Umeå", "Gävle", "Borås", "Sundsvall", "Eskilstuna", "Karlstad", "Täby", "Växjö", "Halmstad"],
  "Norway": ["Oslo", "Bergen", "Trondheim", "Stavanger", "Drammen", "Fredrikstad", "Kristiansand", "Sandnes", "Tromsø", "Sarpsborg", "Skien", "Bodø", "Drammen", "Lillestrøm", "Haugesund", "Moss", "Sandefjord", "Arendal", "Hamar", "Kongsberg"],
  "Denmark": ["Copenhagen", "Aarhus", "Odense", "Aalborg", "Esbjerg", "Randers", "Kolding", "Horsens", "Vejle", "Roskilde", "Herning", "Hørsholm", "Helsingør", "Silkeborg", "Næstved", "Fredericia", "Viborg", "Køge", "Holstebro", "Taastrup"],
  "Finland": ["Helsinki", "Espoo", "Tampere", "Vantaa", "Turku", "Oulu", "Lahti", "Kuopio", "Jyväskylä", "Pori", "Lappeenranta", "Rovaniemi", "Vaasa", "Joensuu", "Hameenlinna", "Porvoo", "Mikkeli", "Hyvinkää", "Nurmijarvi", "Järvenpää"],
  "Russia": ["Moscow", "Saint Petersburg", "Novosibirsk", "Yekaterinburg", "Kazan", "Nizhny Novgorod", "Samara", "Omsk", "Rostov-on-Don", "Ufa", "Krasnoyarsk", "Voronezh", "Perm", "Volgograd", "Chelyabinsk", "Saratov", "Tyumen", "Tolyatti", "Izhevsk", "Krasnodar"],
  "Turkey": ["Istanbul", "Ankara", "Izmir", "Bursa", "Adana", "Gaziantep", "Konya", "Antalya", "Kayseri", "Mersin", "Eskisehir", "Diyarbakir", "Samsun", "Denizli", "Sanliurfa", "Adapazari", "Malatya", "Kahramanmaras", "Erzurum", "Van"],
  "Egypt": ["Cairo", "Alexandria", "Giza", "Shubra El-Kheima", "Port Said", "Suez", "Luxor", "Mansoura", "Tanta", "Asyut", "Ismailia", "Fayyum", "Zagazig", "Aswan", "Minya", "Damanhur", "Beni Suef", "Qena", "Sohag", "Hurghada"],
  "South Korea": ["Seoul", "Busan", "Incheon", "Daegu", "Daejeon", "Gwangju", "Suwon", "Ulsan", "Changwon", "Goyang", "Seongnam", "Bucheon", "Jeonju", "Ansan", "Cheongju", "Namyangju", "Pohang", "Cheonan", "Hwaseong", "Siheung"],
  "Singapore": ["Singapore"],
  "Indonesia": ["Jakarta", "Surabaya", "Bandung", "Medan", "Semarang", "Makassar", "Palembang", "Depok", "Tangerang", "Bekasi", "Malang", "Pekanbaru", "Denpasar", "Yogyakarta", "Serang", "Cilegon", "Bogor", "Batam", "Jambi", "Solo"],
  "Thailand": ["Bangkok", "Nonthaburi", "Pak Kret", "Hat Yai", "Chiang Mai", "Nakhon Ratchasima", "Pattaya", "Udon Thani", "Khon Kaen", "Chonburi", "Nakhon Si Thammarat", "Lampang", "Phuket", "Surat Thani", "Chiang Rai", "Samut Prakan", "Rayong", "Ubon Ratchathani", "Ratchaburi", "Saraburi"],
  "Philippines": ["Manila", "Quezon City", "Davao City", "Cebu City", "Zamboanga City", "Antipolo", "Pasig", "Taguig", "Cagayan de Oro", "Parañaque", "Makati", "Bacolod", "General Santos", "Marikina", "Muntinlupa", "San Juan", "Caloocan", "Las Piñas", "Mandaluyong", "Valenzuela"],
  "Vietnam": ["Ho Chi Minh City", "Hanoi", "Da Nang", "Hai Phong", "Can Tho", "Bien Hoa", "Hue", "Nha Trang", "Vinh", "Phan Thiet", "Buon Ma Thuot", "Rach Gia", "Vung Tau", "Thai Nguyen", "Nam Dinh", "Qui Nhon", "My Tho", "Long Xuyen", "Thai Binh", "Ha Long"],
  "Malaysia": ["Kuala Lumpur", "George Town", "Ipoh", "Johor Bahru", "Kota Kinabalu", "Kuching", "Malacca City", "Shah Alam", "Petaling Jaya", "Klang", "Seremban", "Mir i", "Kuantan", "Sandakan", "Tawau", "Alor Setar", "Bintulu", "Sibu", "Kangar", "Kota Bharu"],
  "Pakistan": ["Karachi", "Lahore", "Faisalabad", "Rawalpindi", "Islamabad", "Peshawar", "Multan", "Quetta", "Gujranwala", "Sargodha", "Sialkot", "Bahawalpur", "Sukkur", "Jhang", "Sheikhupura", "Gujrat", "Mardan", "Kasur", "Rahim Yar Khan", "Sahiwal"],
  "Bangladesh": ["Dhaka", "Chittagong", "Khulna", "Rajshahi", "Sylhet", "Comilla", "Rangpur", "Gazipur", "Narayanganj", "Mymensingh", "Bogra", "Barisal", "Cox's Bazar", "Jessore", "Dinajpur", "Brahmanbaria", "Savar", "Narsingdi", "Tongi", "Nawabganj"],
  "Iran": ["Tehran", "Mashhad", "Isfahan", "Karaj", "Shiraz", "Tabriz", "Qom", "Ahvaz", "Kermanshah", "Urmia", "Rasht", "Kerman", "Arak", "Yazd", "Ardabil", "Bandar Abbas", "Esfahan", "Zanjan", "Hamadan", "Qazvin"],
  "Iraq": ["Baghdad", "Basra", "Mosul", "Erbil", "Sulaymaniyah", "Kirkuk", "Najaf", "Karbala", "Nasiriyah", "Hillah", "Fallujah", "Ramadi", "Kut", "Samawah", "Diwaniyah", "Dohuk", "Zakho", "Amara", "Baqubah", "Tikrit"],
  "Israel": ["Jerusalem", "Tel Aviv", "Haifa", "Rishon LeZion", "Petah Tikva", "Ashdod", "Netanya", "Beersheba", "Bnei Brak", "Holon", "Ramat Gan", "Ashkelon", "Rehovot", "Bat Yam", "Herzliya", "Kfar Saba", "Ra'anana", "Modi'in", "Lod", "Nazareth"],
  "Greece": ["Athens", "Thessaloniki", "Patras", "Heraklion", "Larissa", "Volos", "Ioannina", "Chania", "Chalcis", "Agrinio", "Kavala", "Katerini", "Lamia", "Alexandroupoli", "Veria", "Serres", "Xanthi", "Kalamata", "Komotini", "Rhodes"],
  "Poland": ["Warsaw", "Kraków", "Łódź", "Wrocław", "Poznań", "Gdańsk", "Szczecin", "Bydgoszcz", "Lublin", "Białystok", "Katowice", "Gdynia", "Częstochowa", "Radom", "Sosnowiec", "Toruń", "Kielce", "Rzeszów", "Gliwice", "Zabrze"],
  "Czech Republic": ["Prague", "Brno", "Ostrava", "Plzeň", "Liberec", "Olomouc", "Ústí nad Labem", "České Budějovice", "Hradec Králové", "Pardubice", "Karlovy Vary", "Jihlava", "Teplice", "Děčín", "Havířov", "Kroměříž", "Vsetín", "Opava", "Most", "Frýdek-Místek"],
  "Hungary": ["Budapest", "Debrecen", "Szeged", "Miskolc", "Pécs", "Győr", "Nyíregyháza", "Kecskemét", "Székesfehérvár", "Szombathely", "Szolnok", "Tatabánya", "Kaposvár", "Békéscsaba", "Zalaegerszeg", "Veszprém", "Eger", "Érd", "Sopron", "Dunaújváros"],
  "Romania": ["Bucharest", "Cluj-Napoca", "Timișoara", "Iași", "Constanța", "Craiova", "Brașov", "Galați", "Ploiești", "Oradea", "Brăila", "Arad", "Pitești", "Sibiu", "Bacău", "Târgu Mureș", "Baia Mare", "Buzău", "Botoșani", "Satu Mare"],
  "Ukraine": ["Kyiv", "Kharkiv", "Odesa", "Dnipro", "Zaporizhzhia", "Lviv", "Kryvyi Rih", "Mariupol", "Vinnytsia", "Mykolaiv", "Kherson", "Poltava", "Chernihiv", "Cherkasy", "Khmelnytskyi", "Zhytomyr", "Chernivtsi", "Sumy", "Rivne", "Kropyvnytskyi"],
  "Morocco": ["Casablanca", "Rabat", "Marrakech", "Fes", "Tangier", "Agadir", "Meknes", "Oujda", "Kenitra", "Tetouan", "Safi", "El Jadida", "Nador", "Beni Mellal", "Khouribga", "Béni Mellal", "Settat", "Taza", "Mohammedia", "Ouarzazate"],
  "Argentina": ["Buenos Aires", "Córdoba", "Rosario", "Mendoza", "La Plata", "Mar del Plata", "San Miguel de Tucumán", "Salta", "Santa Fe", "San Juan", "Resistencia", "Neuquén", "Santiago del Estero", "Corrientes", "Posadas", "San Salvador de Jujuy", "Bahía Blanca", "Paraná", "Formosa", "Neuquén"],
  "Chile": ["Santiago", "Valparaíso", "Concepción", "La Serena", "Antofagasta", "Temuco", "Rancagua", "Talca", "Arica", "Chillán", "Iquique", "Los Ángeles", "Puerto Montt", "Coquimbo", "Osorno", "Valdivia", "Punta Arenas", "Copiapó", "Quilpué", "Curicó"],
  "Colombia": ["Bogotá", "Medellín", "Cali", "Barranquilla", "Cartagena", "Bucaramanga", "Cúcuta", "Soledad", "Ibagué", "Soacha", "Pasto", "Manizales", "Bello", "Montería", "Neiva", "Villavicencio", "Armenia", "Valledupar", "Buenaventura", "Popayán"],
  "Peru": ["Lima", "Arequipa", "Trujillo", "Chiclayo", "Piura", "Iquitos", "Cusco", "Huancayo", "Pucallpa", "Chimbote", "Tacna", "Juliaca", "Ica", "Cajamarca", "Puno", "Sullana", "Huaraz", "Ayacucho", "Tumbes", "Tarapoto"],
  "Venezuela": ["Caracas", "Maracaibo", "Valencia", "Barquisimeto", "Maracay", "Barcelona", "Ciudad Guayana", "Maturín", "Barinas", "Cumaná", "Mérida", "Guatire", "Baruta", "Petare", "Turmero", "Puerto La Cruz", "Los Teques", "Punto Fijo", "Guarenas", "Valera"],
  "New Zealand": ["Auckland", "Wellington", "Christchurch", "Hamilton", "Tauranga", "Napier-Hastings", "Dunedin", "Palmerston North", "Nelson", "Rotorua", "Whangarei", "New Plymouth", "Invercargill", "Whanganui", "Gisborne", "Porirua", "Rotorua", "Lower Hutt", "Hastings", "Upper Hutt"],
  "Ireland": ["Dublin", "Cork", "Limerick", "Galway", "Waterford", "Drogheda", "Dundalk", "Swords", "Bray", "Navan", "Kilkenny", "Ennis", "Carlow", "Tralee", "Newbridge", "Portlaoise", "Balbriggan", "Naas", "Athlone", "Letterkenny"],
  "Austria": ["Vienna", "Graz", "Linz", "Salzburg", "Innsbruck", "Klagenfurt", "Villach", "Wels", "St. Pölten", "Dornbirn", "Wiener Neustadt", "Steyr", "Feldkirch", "Bregenz", "Leonding", "Klosterneuburg", "Baden bei Wien", "Wolfsberg", "Krems", "Traun"],
  "Portugal": ["Lisbon", "Porto", "Amadora", "Braga", "Coimbra", "Funchal", "Setúbal", "Aveiro", "Viseu", "Leiria", "Faro", "Vila Nova de Gaia", "Évora", "Guarda", "Beja", "Castelo Branco", "Santarém", "Portalegre", "Bragança", "Viana do Castelo"],
  "Belgium": ["Brussels", "Antwerp", "Ghent", "Charleroi", "Liège", "Bruges", "Namur", "Leuven", "Mons", "Mechelen", "Aalst", "Kortrijk", "Hasselt", "Ostend", "Sint-Niklaas", "Tournai", "Genk", "Hoboken", "Verviers", "Mouscron"],
  "Qatar": ["Doha", "Al Rayyan", "Al Wakrah", "Al Khor", "Dukhan", "Mesaieed", "Ras Laffan", "Industrial Area", "Umm Salal", "Al Daayen"],
  "Kuwait": ["Kuwait City", "Al Ahmadi", "Hawalli", "Farwaniya", "Jahra", "Mubarak Al-Kabeer", "Sabah Al-Salem", "Sabah Al-Ahmad", "Jabriya", "Salmiya"],
  "Oman": ["Muscat", "Seeb", "Salalah", "Sohar", "Nizwa", "Sur", "Ibri", "Buraimi", "Khasab", "Rustaq"],
  "Jordan": ["Amman", "Zarqa", "Irbid", "Aqaba", "Salt", "Mafraq", "Jerash", "Madaba", "Karak", "Tafilah"],
  "Lebanon": ["Beirut", "Tripoli", "Sidon", "Tyre", "Nabatieh", "Baalbek", "Jounieh", "Zahle", "Byblos", "Batroun"],
  "Ghana": ["Accra", "Kumasi", "Tamale", "Takoradi", "Cape Coast", "Sekondi-Takoradi", "Obuasi", "Tema", "Ashaiman", "Sunyani", "Wa", "Ho", "Bolgatanga", "Koforidua", "Techiman", "Cape Coast", "Winneba", "Hohoe", "Navrongo", "Damango"],
  "Tanzania": ["Dar es Salaam", "Mwanza", "Arusha", "Dodoma", "Mbeya", "Morogoro", "Tanga", "Kahama", "Zanzibar City", "Tabora", "Kigoma", "Musoma", "Iringa", "Shinyanga", "Moshi", "Songea", "Mtwara", "Singida", "Bukoba", "Lindi"],
  "Uganda": ["Kampala", "Gulu", "Lira", "Mbarara", "Jinja", "Mbale", "Entebbe", "Arua", "Masaka", "Kasese", "Wakiso", "Mukono", "Lugazi", "Kabale", "Soroti", "Tororo", "Mubende", "Iganga", "Fort Portal", "Hoima"],
  "Sudan": ["Khartoum", "Omdurman", "Port Sudan", "Kassala", "El Obeid", "Nyala", "Al-Fashir", "Kosti", "Wad Madani", "Al-Qadarif", "Kordofan", "Juba", "Malakal", "Wau", "Dongola", "Atbara", "Kusti", "Singa", "Kadugli", "Geneina"],
  "Algeria": ["Algiers", "Oran", "Constantine", "Annaba", "Blida", "Batna", "Djelfa", "Sétif", "Sidi Bel Abbès", "Biskra", "Tébessa", "Tiaret", "Béjaïa", "Tlemcen", "Ouargla", "Skikda", "Bordj Bou Arréridj", "Mostaganem", "Ghardaia", "Mascara"],
  "Tunisia": ["Tunis", "Sfax", "Sousse", "Kairouan", "Gabès", "Bizerte", "Ariana", "Gafsa", "Monastir", "Ben Arous", "Kasserine", "Medenine", "Nabeul", "Tataouine", "Mahdia", "Sidi Bouzid", "Jendouba", "Tozeur", "Zaghouan", "Kef"],
  "Morocco": ["Casablanca", "Rabat", "Marrakech", "Fes", "Tangier", "Agadir", "Meknes", "Oujda", "Kenitra", "Tetouan", "Safi", "El Jadida", "Nador", "Beni Mellal", "Khouribga", "Settat", "Taza", "Mohammedia", "Ouarzazate", "Berkane"],
  "Zimbabwe": ["Harare", "Bulawayo", "Chitungwiza", "Mutare", "Epworth", "Gweru", "Kwekwe", "Kadoma", "Masvingo", "Chinhoyi", "Marondera", "Ruwa", "Bindura", "Zvishavane", "Victoria Falls", "Hwange", "Kariba", "Karoi", "Redcliff", "Rusape"],
  "Zambia": ["Lusaka", "Ndola", "Kitwe", "Kabwe", "Chingola", "Livingstone", "Luanshya", "Mufulira", "Kasama", "Chipata", "Mazabuka", "Kapiri Mposhi", "Chililabombwe", "Kalulushi", "Choma", "Mongu", "Solwezi", "Sesheke", "Mumbwa", "Monze"],
  "Afghanistan": ["Kabul", "Kandahar", "Herat", "Mazar-i-Sharif", "Jalalabad", "Kunduz", "Ghazni", "Baghlan", "Bamyan", "Khost", "Puli Khumri", "Lashkar Gah", "Talogan", "Sar-e Pol", "Farah", "Fayzabad", "Zaranj", "Maymana", "Sheberghan", "Gardez"],
  "Myanmar": ["Yangon", "Mandalay", "Naypyidaw", "Mawlamyine", "Bago", "Taunggyi", "Monywa", "Sittwe", "Meiktila", "Dawei", "Myeik", "Mergui", "Hpa-An", "Pathein", "Pyay", "Lashio", "Hinthada", "Magway", "Myitkyina", "Toungoo"],
  "Cambodia": ["Phnom Penh", "Siem Reap", "Battambang", "Sihanoukville", "Kampong Cham", "Takeo", "Kampong Speu", "Pursat", "Kampot", "Kampong Chhnang", "Kandal", "Prey Veng", "Svay Rieng", "Kampong Thom", "Oddar Meanchey", "Kep", "Pailin", "Tbong Khmum", "Koh Kong", "Banteay Meanchey"],
  "Laos": ["Vientiane", "Pakse", "Savannakhet", "Luang Prabang", "Xam Neua", "Thakhek", "Muang Xay", "Phonsavan", "Muang Pakxan", "Ban Houayxay", "Salavan", "Luang Namtha", "Kaysone Phomvihane", "Vang Vieng", "Sainyabuli", "Attopeu", "Muang Kasi", "Pakxan", "Xaysetha", "Sanakham"],
  "Nepal": ["Kathmandu", "Pokhara", "Lalitpur", "Biratnagar", "Birgunj", "Bharatpur", "Birganj", "Bhim Datta", "Butwal", "Birtamod", "Dharan", "Bhadrapur", "Dhangadhi", "Mahendranagar", "Janakpur", "Nepalgunj", "Hetauda", "Kalaiya", "Damak", "Tikapur"],
  "Sri Lanka": ["Colombo", "Dehiwala-Mount Lavinia", "Moratuwa", "Kandy", "Jaffna", "Negombo", "Galle", "Kalmunai", "Vavuniya", "Trincomalee", "Batticaloa", "Katunayake", "Dambulla", "Kuliyapitiya", "Anuradhapura", "Ragama", "Kurunegala", "Gampaha", "Matara", "Kalutara"],
  "Maldives": ["Malé", "Addu City", "Fuvahmulah", "Kulhudhuffushi", "Thinadhoo", "Naifaru", "Hithadhoo", "Kudahuvadhoo", "Maradhoo", "Gan"],
  "Bhutan": ["Thimphu", "Phuntsholing", "Paro", "Samdrup Jongkhar", "Gelephu", "Wangdue Phodrang", "Punakha", "Bumthang", "Trashigang", "Mongar"],
  "Mongolia": ["Ulaanbaatar", "Erdenet", "Darkhan", "Choibalsan", "Mörön", "Khovd", "Ölgii", "Uliastai", "Arvaikheer", "Sainshand"],
  "Kazakhstan": ["Almaty", "Nur-Sultan", "Shymkent", "Aktobe", "Karaganda", "Taraz", "Pavlodar", "Oskemen", "Semey", "Atyrau", "Kostanay", "Kyzylorda", "Uralsk", "Petropavl", "Temirtau", "Turkestan", "Taldykorgan", "Kokshetau", "Ekibastuz", "Rudny"],
  "Uzbekistan": ["Tashkent", "Samarkand", "Namangan", "Andijan", "Bukhara", "Nukus", "Fergana", "Qarshi", "Kokand", "Margilan", "Jizzakh", "Angren", "Chirchiq", "Navoiy", "Urgench", "Termez", "Almalyk", "Guliston", "Bekobod", "Olmalik"],
  "Kyrgyzstan": ["Bishkek", "Osh", "Jalal-Abad", "Karakol", "Tokmok", "Uzgen", "Kyzyl-Kiya", "Naryn", "Talas", "Batken", "Kara-Balta", "Kant", "Karakul", "Mailuu-Suu", "Tash-Kömür", "Cholpon-Ata", "Isfana", "Kök-Janggak", "Shopokov", "Sulukta"],
  "Tajikistan": ["Dushanbe", "Khujand", "Kulob", "Qurghonteppa", "Istaravshan", "Kanibadam", "Isfara", "Panjakent", "Khorugh", "Vahdat", "Konibodom", "Tursunzoda", "Yovon", "Buston", "Norak", "Roghun", "Danghara", "Iftixor", "Gharm", "Vose"],
  "Turkmenistan": ["Ashgabat", "Türkmenabat", "Daşoguz", "Mary", "Balkanabat", "Tejen", "Gumdag", "Turkmenbashi", "Abadan", "Gazanjyk", "Goktepe", "Baharly", "Atamyrat", "Serdar", "Kakha", "Garrygala", "Magdanly", "Gowurdak", "Sydyrshayak", "Mekan"],
  "Armenia": ["Yerevan", "Gyumri", "Vanadzor", "Vagharshapat", "Abovyan", "Kapan", "Hrazdan", "Armavir", "Artashat", "Ijevan", "Gavarr", "Charentsavan", "Masis", "Artik", "Sevan", "Dilijan", "Alaverdi", "Ashtarak", "Stepanavan", "Metsamor"],
  "Azerbaijan": ["Baku", "Ganja", "Sumqayit", "Lankaran", "Mingachevir", "Nakhchivan", "Shirvan", "Sheki", "Yevlakh", "Khachmaz", "Agdam", "Barda", "Quba", "Qusar", "Goychay", "Kurdamir", "Imishli", "Salyan", "Sabirabad", "Shamakhi"],
  "Georgia": ["Tbilisi", "Batumi", "Kutaisi", "Rustavi", "Zugdidi", "Gori", "Poti", "Sukhumi", "Tskhinvali", "Telavi", "Akhaltsikhe", "Kobuleti", "Ozurgeti", "Samtredia", "Senaki", "Zestaponi", "Khoni", "Chiatura", "Marneuli", "Bolnisi"],
  "Serbia": ["Belgrade", "Novi Sad", "Niš", "Kragujevac", "Subotica", "Leskovac", "Kruševac", "Zrenjanin", "Pančevo", "Čačak", "Novi Pazar", "Kraljevo", "Smederevo", "Vranje", "Užice", "Valjevo", "Šabac", "Niš", "Zaječar", "Kikinda"],
  "Croatia": ["Zagreb", "Split", "Rijeka", "Osijek", "Zadar", "Pula", "Slavonski Brod", "Karlovac", "Varaždin", "Šibenik", "Dubrovnik", "Velika Gorica", "Osijek", "Samobor", "Vinkovci", "Vukovar", "Kaštela", "Sisak", "Sinj", "Požega"],
  "Slovenia": ["Ljubljana", "Maribor", "Celje", "Kranj", "Velenje", "Koper", "Novo Mesto", "Ptuj", "Nova Gorica", "Domžale", "Murska Sobota", "Slovenj Gradec", "Krško", "Trbovlje", "Jesenice", "Izola", "Škofja Loka", "Kamnik", "Postojna", "Črnomelj"],
  "Slovakia": ["Bratislava", "Košice", "Prešov", "Žilina", "Nitra", "Banská Bystrica", "Trnava", "Martin", "Trenčín", "Poprad", "Prievidza", "Zvolen", "Považská Bystrica", "Nové Zámky", "Michalovce", "Spišská Nová Ves", "Komárno", "Levice", "Humenné", "Bardejov"],
  "Bulgaria": ["Sofia", "Plovdiv", "Varna", "Burgas", "Ruse", "Stara Zagora", "Pleven", "Sliven", "Dobrich", "Shumen", "Pernik", "Haskovo", "Yambol", "Pazardzhik", "Blagoevgrad", "Veliko Tarnovo", "Vratsa", "Gabrovo", "Asenovgrad", "Kazanlak"],
  "Latvia": ["Riga", "Daugavpils", "Liepāja", "Jelgava", "Jūrmala", "Ventspils", "Rēzekne", "Ogre", "Valmiera", "Tukums", "Jēkabpils", "Salaspils", "Cēsis", "Kuldīga", "Olaine", "Jelgava", "Saldus", "Talsi", "Dobele", "Bauska"],
  "Lithuania": ["Vilnius", "Kaunas", "Klaipėda", "Šiauliai", "Panevėžys", "Alytus", "Marijampolė", "Mažeikiai", "Jonava", "Utena", "Kėdainiai", "Telšiai", "Visaginas", "Tauragė", "Ukmergė", "Šilutė", "Plungė", "Kretinga", "Radviliškis", "Druskininkai"],
  "Estonia": ["Tallinn", "Tartu", "Narva", "Pärnu", "Kohtla-Järve", "Viljandi", "Rakvere", "Sillamäe", "Maardu", "Kuressaare", "Võru", "Valga", "Jõhvi", "Haapsalu", "Keila", "Paide", "Tapa", "Põlva", "Jõgeva", "Rapla"],
  "Iceland": ["Reykjavík", "Kópavogur", "Hafnarfjörður", "Akureyri", "Reykjanesbær", "Garðabær", "Mosfellsbær", "Ísafjörður", "Seltjarnarnes", "Selfoss", "Akranes", "Vestmannaeyjar", "Sauðárkrókur", "Höfn", "Húsavík", "Keflavík", "Borgarnes", "Hveragerði", "Neskaupstaður", "Stykkishólmur"],
  "Luxembourg": ["Luxembourg City", "Esch-sur-Alzette", "Differdange", "Dudelange", "Ettelbruck", "Diekirch", "Wiltz", "Echternach", "Rumelange", "Grevenmacher", "Bertrange", "Mamer", "Strassen", "Hesperange", "Bridel", "Betzdorf", "Kayl", "Schifflange", "Petange", "Mondercange"],
  "Malta": ["Valletta", "Birkirkara", "Mosta", "Rabat", "St. Paul's Bay", "Qormi", "Zabbar", "Sliema", "Zebbug", "Hamrun", "Naxxar", "Attard", "Marsaskala", "Marsaxlokk", "Gzira", "San Gwann", "Paola", "Tarxien", "Balzan", "Birgu"],
  "Cyprus": ["Nicosia", "Limassol", "Larnaca", "Paphos", "Famagusta", "Kyrenia", "Paralimni", "Polis", "Morphou", "Ypsonas"],
  "Monaco": ["Monte Carlo", "La Condamine", "Fontvieille", "Le Portier", "Moneghetti", "Saint Michel", "La Rousse", "Larvotto", "Malbousquet", "Les Révoires"],
  "San Marino": ["San Marino", "Serravalle", "Borgo Maggiore", "Domagnano", "Fiorentino", "Acquaviva", "Faetano", "Chiesanuova", "Montegiardino"],
  "Liechtenstein": ["Vaduz", "Schaan", "Balzers", "Triesen", "Eschen", "Mauren", "Triesenberg", "Ruggell", "Gamprin", "Schellenberg"],
  "Andorra": ["Andorra la Vella", "Escaldes-Engordany", "Encamp", "Sant Julià de Lòria", "La Massana", "Santa Coloma", "Ordino", "Canillo", "El Pas de la Casa", "Soldeu"],
  "Vatican City": ["Vatican City"],
  "Bosnia and Herzegovina": ["Sarajevo", "Banja Luka", "Tuzla", "Zenica", "Mostar", "Bijeljina", "Brčko", "Prijedor", "Trebinje", "Doboj", "Cazin", "Bihać", "Gračanica", "Velika Kladuša", "Visoko", "Gradačac", "Livno", "Široki Brijeg", "Lukavac", "Travnik"],
  "Montenegro": ["Podgorica", "Nikšić", "Pljevlja", "Bijelo Polje", "Cetinje", "Bar", "Herceg Novi", "Berane", "Budva", "Ulcinj", "Tivat", "Kotor", "Rožaje", "Plav", "Danilovgrad", "Mojkovac", "Plužine", "Žabljak", "Kolašin", "Andrijevica"],
  "Kosovo": ["Pristina", "Prizren", "Ferizaj", "Peć", "Gjakova", "Gjilan", "Mitrovica", "Podujevo", "Suva Reka", "Glogovac", "Kačanik", "Vitina", "Orahovac", "Lipljan", "Štrpce", "Istok", "Klina", "Decani", "Đakovica", "Uroševac"],
  "North Macedonia": ["Skopje", "Bitola", "Kumanovo", "Prilep", "Tetovo", "Ohrid", "Gostivar", "Štip", "Strumica", "Veles", "Struga", "Kavadarci", "Kochani", "Kichevo", "Prilep", "Radovish", "Gevgelija", "Debar", "Kriva Palanka", "Negotino"],
  "Albania": ["Tirana", "Durrës", "Vlorë", "Shkodër", "Fier", "Elbasan", "Korçë", "Berat", "Lushnjë", "Gjirokastër", "Pogradec", "Sarandë", "Kukës", "Lezhë", "Kavajë", "Ballsh", "Patos", "Kuçovë", "Kukës", "Rrogozhinë"],
  "Moldova": ["Chișinău", "Tiraspol", "Bălți", "Bender", "Ribnița", "Cahul", "Ungheni", "Soroca", "Orhei", "Dubăsari", "Comrat", "Căușeni", "Strășeni", "Ceadîr-Lunga", "Vulcănești", "Taraclia", "Ialoveni", "Hîncești", "Nisporeni", "Fălești"],
  "Belarus": ["Minsk", "Gomel", "Mogilev", "Vitebsk", "Grodno", "Brest", "Bobruisk", "Baranovichi", "Borisov", "Pinsk", "Orsha", "Mozyr", "Soligorsk", "Novopolotsk", "Lida", "Molodechno", "Polotsk", "Zhlobin", "Svetlogorsk", "Rechitsa"],
};

// ============================================
// ALL LANGUAGES OF THE WORLD
// ============================================

export const languages = [
  // Major Languages by Native Speakers
  "Mandarin Chinese", "Spanish", "English", "Hindi", "Arabic", "Bengali", "Portuguese",
  "Russian", "Japanese", "German", "Korean", "French", "Turkish", "Tamil", "Vietnamese",
  "Telugu", "Marathi", "Chinese (Cantonese)", "Wu Chinese", "Persian (Farsi)",
  // European Languages
  "Italian", "Dutch", "Polish", "Ukrainian", "Romanian", "Greek", "Czech", "Swedish",
  "Hungarian", "Finnish", "Bulgarian", "Slovak", "Danish", "Norwegian", "Serbian",
  "Croatian", "Slovenian", "Lithuanian", "Latvian", "Estonian", "Basque", "Catalan",
  "Galician", "Welsh", "Irish", "Scottish Gaelic", "Albanian", "Macedonian", "Bosnian",
  "Belarusian", "Georgian", "Armenian", "Azerbaijani", "Kazakh", "Uzbek", "Turkmen",
  "Kyrgyz", "Tajik", "Moldovan",
  // Asian Languages
  "Thai", "Burmese", "Khmer", "Lao", "Malay", "Indonesian", "Tagalog (Filipino)",
  "Hmong", "Tibetan", "Nepali", "Sinhala", "Dhivehi", "Punjabi", "Gujarati", "Kannada",
  "Malayalam", "Odia", "Assamese", "Urdu", "Pashto", "Kurdish", "Dari", "Balochi",
  "Hebrew", "Amharic", "Tigrinya", "Oromo", "Somali", "Hausa", "Yoruba", "Igbo",
  "Zulu", "Xhosa", "Swahili", "Afrikaans", "Shona", "Kinyarwanda", "Luganda",
  // Middle Eastern Languages
  "Farsi", "Dari", "Pashto", "Kurdish (Sorani)", "Kurdish (Kurmanji)", "Arabic (Egyptian)",
  "Arabic (Gulf)", "Arabic (Levantine)", "Arabic (Maghrebi)", "Hebrew", "Aramaic",
  // Other Languages
  "Chamorro", "Fijian", "Hawaiian", "Maori", "Samoan", "Tongan", "Tahitian",
  "Malagasy", "Sesotho", "Tswana", "Northern Sotho", "Tsonga", "Swati", "Venda",
  "Ndebele", "Wolof", "Fula", "Serer", "Diola", "Bambara", "Mossi", "Dyula",
  "Bemba", "Chewa", "Kikongo", "Lingala", "Luba-Kasai", "Kongo", "Kikuyu",
  "Luo", "Kamba", "Masai", "Turkana", "Kalenjin", "Tigrinya", "Oromo", "Sidamo",
  "Amharic", "Tigre", "Afar", "Somali", "Beja", "Nuer", "Dinka", "Shilluk",
  "Sign Language (ASL)", "Sign Language (BSL)", "Sign Language (International)",
  "Esperanto", "Latin", "Ancient Greek", "Sanskrit", "Pali", "Classical Chinese",
  // Additional Languages
  "Abkhaz", "Avar", "Chechen", "Dargwa", "Ingush", "Lezgian", "Tabassaran",
  "Chuvash", "Bashkir", "Tatar", "Udmurt", "Mari", "Mordvin", "Komi",
  "Nenets", "Khanty", "Mansi", "Evenki", "Yakut", "Buryat", "Kalmyk",
  "Tuvan", "Altai", "Khakas", "Shor", "Chukchi", "Koryak", "Itelmen",
  "Yupik", "Inuktitut", "Navajo", "Apache", "Cherokee", "Dakota", "Lakota",
  "Ojibwe", "Cree", "Innu", "Mi'kmaq", "Mohawk", "Oneida", "Seneca",
  "Quechua", "Aymara", "Guaraní", "Mapudungun", "Nahuatl", "Maya", "Mixtec",
  "Zapotec", "Otomi", "Tzotzil", "Tzeltal"
].sort();

// ============================================
// ALL NATIONALITIES OF THE WORLD
// ============================================

export const nationalities = [
  "Afghan", "Albanian", "Algerian", "American", "Andorran", "Angolan",
  "Antiguan and Barbudan", "Argentine", "Armenian", "Australian", "Austrian",
  "Azerbaijani", "Bahamian", "Bahraini", "Bangladeshi", "Barbadian",
  "Belarusian", "Belgian", "Belizean", "Beninese", "Bhutanese", "Bolivian",
  "Bosnian", "Botswanan", "Brazilian", "British", "Bruneian", "Bulgarian",
  "Burkinabe", "Burundian", "Cambodian", "Cameroonian", "Canadian", "Cape Verdean",
  "Central African", "Chadian", "Chilean", "Chinese", "Colombian", "Comoran",
  "Congolese (Congo)", "Congolese (DRC)", "Costa Rican", "Croatian", "Cuban",
  "Cypriot", "Czech", "Danish", "Djiboutian", "Dominican (Commonwealth)",
  "Dominican (Republic)", "Dutch", "East Timorese", "Ecuadorian", "Egyptian",
  "Emirati", "Equatorial Guinean", "Eritrean", "Estonian", "Ethiopian", "Fijian",
  "Filipino", "Finnish", "French", "Gabonese", "Gambian", "Georgian", "German",
  "Ghanaian", "Greek", "Grenadian", "Guatemalan", "Guinean", "Guinea-Bissauan",
  "Guyanese", "Haitian", "Honduran", "Hungarian", "Icelandic", "Indian",
  "Indonesian", "Iranian", "Iraqi", "Irish", "Israeli", "Italian", "Ivorian",
  "Jamaican", "Japanese", "Jordanian", "Kazakh", "Kenyan", "I-Kiribati",
  "Kosovan", "Kuwaiti", "Kyrgyz", "Lao", "Latvian", "Lebanese", "Basotho",
  "Liberian", "Libyan", "Liechtenstein", "Lithuanian", "Luxembourgish",
  "Malagasy", "Malawian", "Malaysian", "Maldivian", "Malian", "Maltese",
  "Marshallese", "Mauritanian", "Mauritian", "Mexican", "Micronesian", "Moldovan",
  "Monégasque", "Mongolian", "Montenegrin", "Moroccan", "Mozambican", "Burmese",
  "Namibian", "Nauruan", "Nepalese", "New Zealand", "Nicaraguan", "Nigerien",
  "Nigerian", "North Korean", "North Macedonian", "Norwegian", "Omani", "Pakistani",
  "Palauan", "Palestinian", "Panamanian", "Papua New Guinean", "Paraguayan",
  "Peruvian", "Polish", "Portuguese", "Qatari", "Romanian", "Russian", "Rwandan",
  "Saint Kitts and Nevis", "Saint Lucian", "Saint Vincent and the Grenadines",
  "Samoan", "San Marinese", "São Tomé and Príncipe", "Saudi", "Senegalese",
  "Serbian", "Seychellois", "Sierra Leonean", "Singaporean", "Slovak", "Slovenian",
  "Solomon Islander", "Somali", "South African", "South Korean", "South Sudanese",
  "Spanish", "Sri Lankan", "Sudanese", "Surinamese", "Swazi", "Swedish", "Swiss",
  "Syrian", "Taiwanese", "Tajik", "Tanzanian", "Thai", "Togolese", "Tongan",
  "Trinidadian and Tobagonian", "Tunisian", "Turkish", "Turkmen", "Tuvaluan",
  "Ugandan", "Ukrainian", "Uruguayan", "Uzbek", "Vanuatuan", "Vatican",
  "Venezuelan", "Vietnamese", "Yemeni", "Zambian", "Zimbabwean"
].sort();

// ============================================
// RELIGIONS OF THE WORLD
// ============================================

export const religions = [
  // Major World Religions
  "Christianity", "Islam", "Hinduism", "Buddhism", "Judaism",
  // Christian Denominations
  "Catholic", "Protestant", "Orthodox", "Anglican", "Baptist", "Methodist",
  "Lutheran", "Presbyterian", "Pentecostal", "Evangelical", "Adventist",
  "Mormon (LDS)", "Jehovah's Witness", "Quaker", "Mennonite", "Amish",
  // Islamic Denominations
  "Sunni Islam", "Shia Islam", "Sufism", "Ahmadiyya", "Ibadi",
  // Buddhist Traditions
  "Theravada Buddhism", "Mahayana Buddhism", "Vajrayana Buddhism", "Zen Buddhism",
  // Hindu Traditions
  "Vaishnavism", "Shaivism", "Shaktism", "Smartism",
  // Jewish Traditions
  "Orthodox Judaism", "Conservative Judaism", "Reform Judaism", "Reconstructionist Judaism",
  // Eastern Religions
  "Sikhism", "Jainism", "Taoism", "Confucianism", "Shinto", "Zoroastrianism",
  "Bahá'í Faith", "Druze", "Yazidi", "Alawite", "Alevi",
  // Traditional/Indigenous Religions
  "Traditional African Religion", "Yoruba Religion", "Vodun (Voodoo)",
  "Candomblé", "Santería", "Obeah", "Traditional Chinese Religion",
  "Shamanism", "Animism", "Paganism", "Wicca", "Druidry",
  // Other Religions
  "Scientology", "Unitarian Universalism", "Rastafarianism",
  "Tenrikyo", "Seicho-No-Ie", "Cao Dai", "Hoahaoism",
  "Cheondoism", "Jeung San Do", "Falun Gong",
  // Spiritual but not religious
  "Spiritual but not religious", "Agnostic", "Atheist", "Humanist", "Secular",
  "No religious preference", "Prefer not to say"
].sort();

// ============================================
// ADDRESS FORMATS BY COUNTRY
// ============================================

export const addressFormats: Record<string, AddressFormatConfig> = {
  // Ethiopia - Special format with Regions, Zones, Woredas
  "Ethiopia": {
    fields: [
      { name: "region", label: "Region", placeholder: "Select region", type: "select", options: ["Addis Ababa", "Oromia", "Amhara", "Tigray", "SNNPR", "Somali", "Afar", "Benishangul-Gumuz", "Gambela", "Harari", "Dire Dawa"], required: true },
      { name: "zone", label: "Zone", placeholder: "Enter zone", type: "text" },
      { name: "woreda", label: "Woreda", placeholder: "Enter woreda", type: "text" },
      { name: "kebele", label: "Kebele", placeholder: "Enter kebele number", type: "text" },
      { name: "houseNumber", label: "House Number", placeholder: "Enter house number", type: "text" },
    ],
    regionLabel: "Region",
    postalLabel: ""
  },
  // USA format
  "United States": {
    fields: [
      { name: "state", label: "State", placeholder: "Select state", type: "select", options: ["Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware", "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota", "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming", "District of Columbia", "Puerto Rico", "Guam", "US Virgin Islands"], required: true },
      { name: "county", label: "County", placeholder: "Enter county", type: "text" },
      { name: "zipCode", label: "ZIP Code", placeholder: "Enter ZIP code", type: "text", required: true },
    ],
    regionLabel: "State",
    postalLabel: "ZIP Code"
  },
  // Canada format
  "Canada": {
    fields: [
      { name: "province", label: "Province/Territory", placeholder: "Select province", type: "select", options: ["Alberta", "British Columbia", "Manitoba", "New Brunswick", "Newfoundland and Labrador", "Northwest Territories", "Nova Scotia", "Nunavut", "Ontario", "Prince Edward Island", "Quebec", "Saskatchewan", "Yukon"], required: true },
      { name: "postalCode", label: "Postal Code", placeholder: "A1A 1A1", type: "text", required: true },
    ],
    regionLabel: "Province",
    postalLabel: "Postal Code"
  },
  // UK format
  "United Kingdom": {
    fields: [
      { name: "county", label: "County", placeholder: "Enter county", type: "text" },
      { name: "postcode", label: "Postcode", placeholder: "Enter postcode", type: "text", required: true },
    ],
    regionLabel: "County",
    postalLabel: "Postcode"
  },
  // Australia format
  "Australia": {
    fields: [
      { name: "state", label: "State/Territory", placeholder: "Select state", type: "select", options: ["New South Wales", "Victoria", "Queensland", "Western Australia", "South Australia", "Tasmania", "Australian Capital Territory", "Northern Territory"], required: true },
      { name: "postcode", label: "Postcode", placeholder: "Enter postcode", type: "text", required: true },
    ],
    regionLabel: "State",
    postalLabel: "Postcode"
  },
  // Germany format
  "Germany": {
    fields: [
      { name: "state", label: "State (Bundesland)", placeholder: "Select state", type: "select", options: ["Baden-Württemberg", "Bavaria", "Berlin", "Brandenburg", "Bremen", "Hamburg", "Hesse", "Lower Saxony", "Mecklenburg-Vorpommern", "North Rhine-Westphalia", "Rhineland-Palatinate", "Saarland", "Saxony", "Saxony-Anhalt", "Schleswig-Holstein", "Thuringia"], required: true },
      { name: "postalCode", label: "Postal Code", placeholder: "Enter postal code", type: "text", required: true },
    ],
    regionLabel: "State",
    postalLabel: "Postal Code"
  },
  // France format
  "France": {
    fields: [
      { name: "region", label: "Region", placeholder: "Select region", type: "select", options: ["Auvergne-Rhône-Alpes", "Bourgogne-Franche-Comté", "Bretagne", "Centre-Val de Loire", "Corse", "Grand Est", "Hauts-de-France", "Île-de-France", "Normandie", "Nouvelle-Aquitaine", "Occitanie", "Pays de la Loire", "Provence-Alpes-Côte d'Azur"] },
      { name: "department", label: "Department", placeholder: "Enter department", type: "text" },
      { name: "postalCode", label: "Postal Code", placeholder: "Enter postal code", type: "text", required: true },
    ],
    regionLabel: "Region",
    postalLabel: "Postal Code"
  },
  // Japan format
  "Japan": {
    fields: [
      { name: "prefecture", label: "Prefecture", placeholder: "Select prefecture", type: "select", options: ["Hokkaido", "Aomori", "Iwate", "Miyagi", "Akita", "Yamagata", "Fukushima", "Ibaraki", "Tochigi", "Gunma", "Saitama", "Chiba", "Tokyo", "Kanagawa", "Niigata", "Toyama", "Ishikawa", "Fukui", "Yamanashi", "Nagano", "Gifu", "Shizuoka", "Aichi", "Mie", "Shiga", "Kyoto", "Osaka", "Hyogo", "Nara", "Wakayama", "Tottori", "Shimane", "Okayama", "Hiroshima", "Yamaguchi", "Tokushima", "Kagawa", "Ehime", "Kochi", "Fukuoka", "Saga", "Nagasaki", "Kumamoto", "Oita", "Miyazaki", "Kagoshima", "Okinawa"], required: true },
      { name: "postalCode", label: "Postal Code", placeholder: "Enter postal code", type: "text", required: true },
    ],
    regionLabel: "Prefecture",
    postalLabel: "Postal Code"
  },
  // India format
  "India": {
    fields: [
      { name: "state", label: "State/UT", placeholder: "Select state", type: "select", options: ["Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Delhi", "Jammu and Kashmir", "Ladakh", "Puducherry", "Chandigarh", "Dadra and Nagar Haveli", "Daman and Diu", "Lakshadweep", "Andaman and Nicobar"], required: true },
      { name: "district", label: "District", placeholder: "Enter district", type: "text" },
      { name: "pinCode", label: "PIN Code", placeholder: "Enter PIN code", type: "text", required: true },
    ],
    regionLabel: "State",
    postalLabel: "PIN Code"
  },
  // China format
  "China": {
    fields: [
      { name: "province", label: "Province/Municipality", placeholder: "Select province", type: "select", options: ["Anhui", "Fujian", "Gansu", "Guangdong", "Guizhou", "Hainan", "Hebei", "Heilongjiang", "Henan", "Hubei", "Hunan", "Jiangsu", "Jiangxi", "Jilin", "Liaoning", "Qinghai", "Shaanxi", "Shandong", "Shanxi", "Sichuan", "Yunnan", "Zhejiang", "Guangxi", "Inner Mongolia", "Ningxia", "Xinjiang", "Tibet", "Beijing", "Shanghai", "Tianjin", "Chongqing", "Hong Kong", "Macau"], required: true },
      { name: "city", label: "City/District", placeholder: "Enter city", type: "text" },
      { name: "postalCode", label: "Postal Code", placeholder: "Enter postal code", type: "text" },
    ],
    regionLabel: "Province",
    postalLabel: "Postal Code"
  },
  // Brazil format
  "Brazil": {
    fields: [
      { name: "state", label: "State", placeholder: "Select state", type: "select", options: ["Acre", "Alagoas", "Amapá", "Amazonas", "Bahia", "Ceará", "Distrito Federal", "Espírito Santo", "Goiás", "Maranhão", "Mato Grosso", "Mato Grosso do Sul", "Minas Gerais", "Pará", "Paraíba", "Paraná", "Pernambuco", "Piauí", "Rio de Janeiro", "Rio Grande do Norte", "Rio Grande do Sul", "Rondônia", "Roraima", "Santa Catarina", "São Paulo", "Sergipe", "Tocantins"], required: true },
      { name: "postalCode", label: "CEP", placeholder: "Enter CEP", type: "text", required: true },
    ],
    regionLabel: "State",
    postalLabel: "CEP"
  },
  // Mexico format
  "Mexico": {
    fields: [
      { name: "state", label: "State", placeholder: "Select state", type: "select", options: ["Aguascalientes", "Baja California", "Baja California Sur", "Campeche", "Chiapas", "Chihuahua", "Coahuila", "Colima", "Durango", "Guanajuato", "Guerrero", "Hidalgo", "Jalisco", "Michoacán", "Morelos", "Nayarit", "Nuevo León", "Oaxaca", "Puebla", "Querétaro", "Quintana Roo", "San Luis Potosí", "Sinaloa", "Sonora", "Tabasco", "Tamaulipas", "Tlaxcala", "Veracruz", "Yucatán", "Zacatecas", "Mexico City"], required: true },
      { name: "postalCode", label: "Código Postal", placeholder: "Enter código postal", type: "text", required: true },
    ],
    regionLabel: "State",
    postalLabel: "Código Postal"
  },
  // South Africa format
  "South Africa": {
    fields: [
      { name: "province", label: "Province", placeholder: "Select province", type: "select", options: ["Eastern Cape", "Free State", "Gauteng", "KwaZulu-Natal", "Limpopo", "Mpumalanga", "North West", "Northern Cape", "Western Cape"], required: true },
      { name: "postalCode", label: "Postal Code", placeholder: "Enter postal code", type: "text", required: true },
    ],
    regionLabel: "Province",
    postalLabel: "Postal Code"
  },
  // Nigeria format
  "Nigeria": {
    fields: [
      { name: "state", label: "State", placeholder: "Select state", type: "select", options: ["Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno", "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT", "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara"], required: true },
      { name: "lga", label: "LGA", placeholder: "Enter Local Government Area", type: "text" },
      { name: "postalCode", label: "Postal Code", placeholder: "Enter postal code", type: "text" },
    ],
    regionLabel: "State",
    postalLabel: "Postal Code"
  },
  // Kenya format
  "Kenya": {
    fields: [
      { name: "county", label: "County", placeholder: "Select county", type: "select", options: ["Baringo", "Bomet", "Bungoma", "Busia", "Elgeyo-Marakwet", "Embu", "Garissa", "Homa Bay", "Isiolo", "Kajiado", "Kakamega", "Kericho", "Kiambu", "Kilifi", "Kirinyaga", "Kisii", "Kisumu", "Kitui", "Kwale", "Laikipia", "Lamu", "Machakos", "Makueni", "Mandera", "Marsabit", "Meru", "Migori", "Mombasa", "Murang'a", "Nairobi", "Nakuru", "Nandi", "Narok", "Nyamira", "Nyandarua", "Nyeri", "Samburu", "Siaya", "Taita-Taveta", "Tana River", "Tharaka-Nithi", "Trans Nzoia", "Turkana", "Uasin Gishu", "Vihiga", "Wajir", "West Pokot"], required: true },
      { name: "postalCode", label: "Postal Code", placeholder: "Enter postal code", type: "text" },
    ],
    regionLabel: "County",
    postalLabel: "Postal Code"
  },
  // Saudi Arabia format
  "Saudi Arabia": {
    fields: [
      { name: "region", label: "Region", placeholder: "Select region", type: "select", options: ["Riyadh", "Makkah", "Madinah", "Eastern Province", "Asir", "Tabuk", "Hail", "Northern Borders", "Jizan", "Najran", "Al Bahah", "Al Jawf", "Qassim"], required: true },
      { name: "postalCode", label: "Postal Code", placeholder: "Enter postal code", type: "text" },
    ],
    regionLabel: "Region",
    postalLabel: "Postal Code"
  },
  // UAE format
  "United Arab Emirates": {
    fields: [
      { name: "emirate", label: "Emirate", placeholder: "Select emirate", type: "select", options: ["Abu Dhabi", "Ajman", "Dubai", "Fujairah", "Ras Al Khaimah", "Sharjah", "Umm Al Quwain"], required: true },
      { name: "poBox", label: "PO Box", placeholder: "Enter PO Box", type: "text" },
    ],
    regionLabel: "Emirate",
    postalLabel: "PO Box"
  },
  // South Korea format
  "South Korea": {
    fields: [
      { name: "province", label: "Province/Metropolitan City", placeholder: "Select province", type: "select", options: ["Seoul", "Busan", "Daegu", "Incheon", "Gwangju", "Daejeon", "Ulsan", "Sejong", "Gyeonggi", "Gangwon", "North Chungcheong", "South Chungcheong", "North Jeolla", "South Jeolla", "North Gyeongsang", "South Gyeongsang", "Jeju"], required: true },
      { name: "postalCode", label: "Postal Code", placeholder: "Enter postal code", type: "text", required: true },
    ],
    regionLabel: "Province",
    postalLabel: "Postal Code"
  },
  // Russia format
  "Russia": {
    fields: [
      { name: "region", label: "Federal Subject", placeholder: "Enter region", type: "text", required: true },
      { name: "postalCode", label: "Postal Code", placeholder: "Enter postal code", type: "text", required: true },
    ],
    regionLabel: "Region",
    postalLabel: "Postal Code"
  },
  // Italy format
  "Italy": {
    fields: [
      { name: "region", label: "Region", placeholder: "Select region", type: "select", options: ["Abruzzo", "Basilicata", "Calabria", "Campania", "Emilia-Romagna", "Friuli-Venezia Giulia", "Lazio", "Liguria", "Lombardy", "Marche", "Molise", "Piedmont", "Apulia", "Sardinia", "Sicily", "Trentino-Alto Adige", "Tuscany", "Umbria", "Aosta Valley", "Veneto"] },
      { name: "province", label: "Province", placeholder: "Enter province", type: "text" },
      { name: "postalCode", label: "CAP", placeholder: "Enter CAP", type: "text", required: true },
    ],
    regionLabel: "Region",
    postalLabel: "CAP"
  },
  // Spain format
  "Spain": {
    fields: [
      { name: "region", label: "Autonomous Community", placeholder: "Select region", type: "select", options: ["Andalusia", "Aragon", "Asturias", "Balearic Islands", "Basque Country", "Canary Islands", "Cantabria", "Castile and León", "Castile-La Mancha", "Catalonia", "Extremadura", "Galicia", "La Rioja", "Madrid", "Murcia", "Navarre", "Valencia", "Ceuta", "Melilla"] },
      { name: "province", label: "Province", placeholder: "Enter province", type: "text" },
      { name: "postalCode", label: "Postal Code", placeholder: "Enter postal code", type: "text", required: true },
    ],
    regionLabel: "Region",
    postalLabel: "Postal Code"
  },
  // Netherlands format
  "Netherlands": {
    fields: [
      { name: "province", label: "Province", placeholder: "Select province", type: "select", options: ["Drenthe", "Flevoland", "Friesland", "Gelderland", "Groningen", "Limburg", "North Brabant", "North Holland", "Overijssel", "South Holland", "Utrecht", "Zeeland"] },
      { name: "postalCode", label: "Postal Code", placeholder: "1234 AB", type: "text", required: true },
    ],
    regionLabel: "Province",
    postalLabel: "Postal Code"
  },
  // Poland format
  "Poland": {
    fields: [
      { name: "voivodeship", label: "Voivodeship", placeholder: "Select voivodeship", type: "select", options: ["Greater Poland", "Kuyavian-Pomeranian", "Lesser Poland", "Łódź", "Lower Silesian", "Lublin", "Lubusz", "Masovian", "Opole", "Podlaskie", "Pomeranian", "Silesian", "Subcarpathian", "Świętokrzyskie", "Warmian-Masurian", "West Pomeranian"], required: true },
      { name: "postalCode", label: "Postal Code", placeholder: "Enter postal code", type: "text", required: true },
    ],
    regionLabel: "Voivodeship",
    postalLabel: "Postal Code"
  },
  // Turkey format
  "Turkey": {
    fields: [
      { name: "province", label: "Province", placeholder: "Enter province", type: "text", required: true },
      { name: "district", label: "District", placeholder: "Enter district", type: "text" },
      { name: "postalCode", label: "Postal Code", placeholder: "Enter postal code", type: "text" },
    ],
    regionLabel: "Province",
    postalLabel: "Postal Code"
  },
  // Egypt format
  "Egypt": {
    fields: [
      { name: "governorate", label: "Governorate", placeholder: "Select governorate", type: "select", options: ["Alexandria", "Aswan", "Asyut", "Beheira", "Beni Suef", "Cairo", "Dakahlia", "Damietta", "Faiyum", "Gharbia", "Giza", "Ismailia", "Kafr El Sheikh", "Luxor", "Matrouh", "Minya", "Monufia", "New Valley", "North Sinai", "Port Said", "Qalyubia", "Qena", "Red Sea", "Sharqia", "Sohag", "South Sinai", "Suez"], required: true },
      { name: "postalCode", label: "Postal Code", placeholder: "Enter postal code", type: "text" },
    ],
    regionLabel: "Governorate",
    postalLabel: "Postal Code"
  },
  // Indonesia format
  "Indonesia": {
    fields: [
      { name: "province", label: "Province", placeholder: "Select province", type: "select", options: ["Aceh", "Bali", "Bangka Belitung", "Banten", "Bengkulu", "Central Java", "Central Kalimantan", "Central Sulawesi", "East Java", "East Kalimantan", "East Nusa Tenggara", "Gorontalo", "Jakarta", "Jambi", "Lampung", "Maluku", "North Kalimantan", "North Maluku", "North Sulawesi", "North Sumatra", "Papua", "Riau", "Riau Islands", "Southeast Sulawesi", "South Kalimantan", "South Sulawesi", "South Sumatra", "West Java", "West Kalimantan", "West Nusa Tenggara", "West Papua", "West Sulawesi", "West Sumatra", "Yogyakarta"], required: true },
      { name: "postalCode", label: "Postal Code", placeholder: "Enter postal code", type: "text", required: true },
    ],
    regionLabel: "Province",
    postalLabel: "Postal Code"
  },
  // Philippines format
  "Philippines": {
    fields: [
      { name: "region", label: "Region", placeholder: "Select region", type: "select", options: ["Ilocos Region", "Cagayan Valley", "Central Luzon", "CALABARZON", "MIMAROPA", "Bicol Region", "Western Visayas", "Central Visayas", "Eastern Visayas", "Zamboanga Peninsula", "Northern Mindanao", "Davao Region", "SOCCSKSARGEN", "Caraga", "Bangsamoro", "Cordillera", "NCR"], required: true },
      { name: "province", label: "Province", placeholder: "Enter province", type: "text" },
      { name: "postalCode", label: "Postal Code", placeholder: "Enter postal code", type: "text", required: true },
    ],
    regionLabel: "Region",
    postalLabel: "Postal Code"
  },
  // Pakistan format
  "Pakistan": {
    fields: [
      { name: "province", label: "Province/Territory", placeholder: "Select province", type: "select", options: ["Punjab", "Sindh", "Khyber Pakhtunkhwa", "Balochistan", "Gilgit-Baltistan", "Azad Kashmir", "Islamabad Capital Territory"], required: true },
      { name: "postalCode", label: "Postal Code", placeholder: "Enter postal code", type: "text" },
    ],
    regionLabel: "Province",
    postalLabel: "Postal Code"
  },
  // Bangladesh format
  "Bangladesh": {
    fields: [
      { name: "division", label: "Division", placeholder: "Select division", type: "select", options: ["Barisal", "Chattogram", "Dhaka", "Khulna", "Mymensingh", "Rajshahi", "Rangpur", "Sylhet"], required: true },
      { name: "district", label: "District", placeholder: "Enter district", type: "text" },
      { name: "postalCode", label: "Postal Code", placeholder: "Enter postal code", type: "text" },
    ],
    regionLabel: "Division",
    postalLabel: "Postal Code"
  },
  // Thailand format
  "Thailand": {
    fields: [
      { name: "province", label: "Province", placeholder: "Select province", type: "select", options: ["Amnat Charoen", "Ang Thong", "Bueng Kan", "Buri Ram", "Chachoengsao", "Chai Nat", "Chaiyaphum", "Chanthaburi", "Chiang Mai", "Chiang Rai", "Chon Buri", "Chumphon", "Kalasin", "Kamphaeng Phet", "Kanchanaburi", "Khon Kaen", "Krabi", "Bangkok", "Lampang", "Lamphun", "Loei", "Lop Buri", "Mae Hong Son", "Maha Sarakham", "Mukdahan", "Nakhon Nayok", "Nakhon Pathom", "Nakhon Phanom", "Nakhon Ratchasima", "Nakhon Sawan", "Nakhon Si Thammarat", "Nan", "Narathiwat", "Nong Bua Lam Phu", "Nong Khai", "Nonthaburi", "Pathum Thani", "Pattani", "Phang Nga", "Phatthalung", "Phayao", "Phetchabun", "Phetchaburi", "Phichit", "Phitsanulok", "Phra Nakhon Si Ayutthaya", "Phrae", "Phuket", "Prachin Buri", "Prachuap Khiri Khan", "Ranong", "Ratchaburi", "Rayong", "Roi Et", "Sa Kaeo", "Sakon Nakhon", "Samut Prakan", "Samut Sakhon", "Samut Songkhram", "Saraburi", "Satun", "Sing Buri", "Sisaket", "Songkhla", "Sukhothai", "Suphan Buri", "Surin", "Tak", "Trang", "Trat", "Ubon Ratchathani", "Udon Thani", "Uthai Thani", "Uttaradit", "Yala", "Yasothon"], required: true },
      { name: "postalCode", label: "Postal Code", placeholder: "Enter postal code", type: "text", required: true },
    ],
    regionLabel: "Province",
    postalLabel: "Postal Code"
  },
  // Vietnam format
  "Vietnam": {
    fields: [
      { name: "province", label: "Province/Municipality", placeholder: "Select province", type: "text", required: true },
      { name: "district", label: "District", placeholder: "Enter district", type: "text" },
      { name: "postalCode", label: "Postal Code", placeholder: "Enter postal code", type: "text" },
    ],
    regionLabel: "Province",
    postalLabel: "Postal Code"
  },
  // Singapore format
  "Singapore": {
    fields: [
      { name: "postalCode", label: "Postal Code", placeholder: "Enter postal code", type: "text", required: true },
    ],
    regionLabel: "",
    postalLabel: "Postal Code"
  },
  // New Zealand format
  "New Zealand": {
    fields: [
      { name: "region", label: "Region", placeholder: "Select region", type: "select", options: ["Northland", "Auckland", "Waikato", "Bay of Plenty", "Gisborne", "Hawke's Bay", "Taranaki", "Manawatu-Whanganui", "Wellington", "Tasman", "Nelson", "Marlborough", "West Coast", "Canterbury", "Otago", "Southland"], required: true },
      { name: "postcode", label: "Postcode", placeholder: "Enter postcode", type: "text", required: true },
    ],
    regionLabel: "Region",
    postalLabel: "Postcode"
  },
  // Ireland format
  "Ireland": {
    fields: [
      { name: "county", label: "County", placeholder: "Select county", type: "select", options: ["Carlow", "Cavan", "Clare", "Cork", "Donegal", "Dublin", "Galway", "Kerry", "Kildare", "Kilkenny", "Laois", "Leitrim", "Limerick", "Longford", "Louth", "Mayo", "Meath", "Monaghan", "Offaly", "Roscommon", "Sligo", "Tipperary", "Waterford", "Westmeath", "Wexford", "Wicklow"], required: true },
      { name: "eircode", label: "Eircode", placeholder: "Enter eircode", type: "text" },
    ],
    regionLabel: "County",
    postalLabel: "Eircode"
  },
  // Sweden format
  "Sweden": {
    fields: [
      { name: "region", label: "Region", placeholder: "Select region", type: "select", options: ["Blekinge", "Dalarna", "Gotland", "Gävleborg", "Halland", "Jämtland", "Jönköping", "Kalmar", "Kronoberg", "Norrbotten", "Örebro", "Östergötland", "Skåne", "Södermanland", "Stockholm", "Uppsala", "Värmland", "Västerbotten", "Västernorrland", "Västra Götaland"], required: true },
      { name: "postalCode", label: "Postal Code", placeholder: "Enter postal code", type: "text", required: true },
    ],
    regionLabel: "Region",
    postalLabel: "Postal Code"
  },
  // Norway format
  "Norway": {
    fields: [
      { name: "county", label: "County", placeholder: "Select county", type: "select", options: ["Agder", "Innlandet", "Møre og Romsdal", "Nordland", "Oslo", "Rogaland", "Sogn og Fjordane", "Troms og Finnmark", "Trøndelag", "Vestfold og Telemark", "Viken"], required: true },
      { name: "postalCode", label: "Postal Code", placeholder: "Enter postal code", type: "text", required: true },
    ],
    regionLabel: "County",
    postalLabel: "Postal Code"
  },
  // Denmark format
  "Denmark": {
    fields: [
      { name: "region", label: "Region", placeholder: "Select region", type: "select", options: ["Capital Region", "Central Denmark", "North Denmark", "Region Zealand", "South Denmark"], required: true },
      { name: "postalCode", label: "Postal Code", placeholder: "Enter postal code", type: "text", required: true },
    ],
    regionLabel: "Region",
    postalLabel: "Postal Code"
  },
  // Finland format
  "Finland": {
    fields: [
      { name: "region", label: "Region", placeholder: "Select region", type: "select", options: ["Lapland", "North Ostrobothnia", "Kainuu", "North Karelia", "North Savo", "South Savo", "South Karelia", "Central Finland", "South Ostrobothnia", "Ostrobothnia", "Central Ostrobothnia", "Pirkanmaa", "Päijät-Häme", "Kanta-Häme", "Uusimaa", "Southwest Finland", "Satakunta", "Åland"], required: true },
      { name: "postalCode", label: "Postal Code", placeholder: "Enter postal code", type: "text", required: true },
    ],
    regionLabel: "Region",
    postalLabel: "Postal Code"
  },
  // Switzerland format
  "Switzerland": {
    fields: [
      { name: "canton", label: "Canton", placeholder: "Select canton", type: "select", options: ["Aargau", "Appenzell Ausserrhoden", "Appenzell Innerrhoden", "Basel-Landschaft", "Basel-Stadt", "Bern", "Fribourg", "Geneva", "Glarus", "Graubünden", "Jura", "Lucerne", "Neuchâtel", "Nidwalden", "Obwalden", "Schaffhausen", "Schwyz", "Solothurn", "St. Gallen", "Thurgau", "Ticino", "Uri", "Valais", "Vaud", "Zug", "Zurich"], required: true },
      { name: "postalCode", label: "Postal Code", placeholder: "Enter postal code", type: "text", required: true },
    ],
    regionLabel: "Canton",
    postalLabel: "Postal Code"
  },
  // Austria format
  "Austria": {
    fields: [
      { name: "state", label: "State", placeholder: "Select state", type: "select", options: ["Burgenland", "Carinthia", "Lower Austria", "Salzburg", "Styria", "Tyrol", "Upper Austria", "Vienna", "Vorarlberg"], required: true },
      { name: "postalCode", label: "Postal Code", placeholder: "Enter postal code", type: "text", required: true },
    ],
    regionLabel: "State",
    postalLabel: "Postal Code"
  },
  // Belgium format
  "Belgium": {
    fields: [
      { name: "region", label: "Region", placeholder: "Select region", type: "select", options: ["Brussels-Capital", "Flemish Region", "Walloon Region"], required: true },
      { name: "province", label: "Province", placeholder: "Enter province", type: "text" },
      { name: "postalCode", label: "Postal Code", placeholder: "Enter postal code", type: "text", required: true },
    ],
    regionLabel: "Region",
    postalLabel: "Postal Code"
  },
  // Portugal format
  "Portugal": {
    fields: [
      { name: "district", label: "District", placeholder: "Select district", type: "select", options: ["Aveiro", "Beja", "Braga", "Bragança", "Castelo Branco", "Coimbra", "Évora", "Faro", "Guarda", "Leiria", "Lisbon", "Portalegre", "Porto", "Santarém", "Setúbal", "Viana do Castelo", "Vila Real", "Viseu"], required: true },
      { name: "postalCode", label: "Postal Code", placeholder: "Enter postal code", type: "text", required: true },
    ],
    regionLabel: "District",
    postalLabel: "Postal Code"
  },
  // Greece format
  "Greece": {
    fields: [
      { name: "region", label: "Region", placeholder: "Select region", type: "select", options: ["Attica", "Central Greece", "Central Macedonia", "Crete", "East Macedonia and Thrace", "Epirus", "Ionian Islands", "North Aegean", "Peloponnese", "South Aegean", "Thessaly", "West Greece", "West Macedonia"], required: true },
      { name: "postalCode", label: "Postal Code", placeholder: "Enter postal code", type: "text", required: true },
    ],
    regionLabel: "Region",
    postalLabel: "Postal Code"
  },
  // Czech Republic format
  "Czech Republic": {
    fields: [
      { name: "region", label: "Region", placeholder: "Select region", type: "select", options: ["Prague", "Central Bohemia", "South Bohemia", "Plzeň", "Karlovy Vary", "Ústí nad Labem", "Liberec", "Hradec Králové", "Pardubice", "Vysočina", "South Moravia", "Olomouc", "Zlín", "Moravia-Silesia"], required: true },
      { name: "postalCode", label: "PSČ", placeholder: "Enter PSČ", type: "text", required: true },
    ],
    regionLabel: "Region",
    postalLabel: "PSČ"
  },
  // Hungary format
  "Hungary": {
    fields: [
      { name: "county", label: "County", placeholder: "Select county", type: "select", options: ["Bács-Kiskun", "Baranya", "Békés", "Borsod-Abaúj-Zemplén", "Csongrád", "Fejér", "Győr-Moson-Sopron", "Hajdú-Bihar", "Heves", "Jász-Nagykun-Szolnok", "Komárom-Esztergom", "Nógrád", "Pest", "Somogy", "Szabolcs-Szatmár-Bereg", "Tolna", "Vas", "Veszprém", "Zala", "Budapest"], required: true },
      { name: "postalCode", label: "Postal Code", placeholder: "Enter postal code", type: "text", required: true },
    ],
    regionLabel: "County",
    postalLabel: "Postal Code"
  },
  // Romania format
  "Romania": {
    fields: [
      { name: "county", label: "County", placeholder: "Select county", type: "text", required: true },
      { name: "postalCode", label: "Postal Code", placeholder: "Enter postal code", type: "text" },
    ],
    regionLabel: "County",
    postalLabel: "Postal Code"
  },
  // Ukraine format
  "Ukraine": {
    fields: [
      { name: "oblast", label: "Oblast", placeholder: "Enter oblast", type: "text", required: true },
      { name: "postalCode", label: "Postal Code", placeholder: "Enter postal code", type: "text", required: true },
    ],
    regionLabel: "Oblast",
    postalLabel: "Postal Code"
  },
  // Morocco format
  "Morocco": {
    fields: [
      { name: "region", label: "Region", placeholder: "Select region", type: "select", options: ["Casablanca-Settat", "Rabat-Salé-Kénitra", "Marrakech-Safi", "Fès-Meknès", "Tanger-Tétouan-Al Hoceïma", "Oriental", "Béni Mellal-Khénifra", "Souss-Massa", "Drâa-Tafilalet", "Laâyoune-Sakia El Hamra", "Dakhla-Oued Ed-Dahab", "Guelmim-Oued Noun"], required: true },
      { name: "postalCode", label: "Postal Code", placeholder: "Enter postal code", type: "text" },
    ],
    regionLabel: "Region",
    postalLabel: "Postal Code"
  },
  // Algeria format
  "Algeria": {
    fields: [
      { name: "wilaya", label: "Wilaya", placeholder: "Enter wilaya", type: "text", required: true },
      { name: "postalCode", label: "Postal Code", placeholder: "Enter postal code", type: "text" },
    ],
    regionLabel: "Wilaya",
    postalLabel: "Postal Code"
  },
  // Tunisia format
  "Tunisia": {
    fields: [
      { name: "governorate", label: "Governorate", placeholder: "Select governorate", type: "select", options: ["Ariana", "Béja", "Ben Arous", "Bizerte", "Gabès", "Gafsa", "Jendouba", "Kairouan", "Kasserine", "Kébili", "Le Kef", "Mahdia", "La Manouba", "Médenine", "Monastir", "Nabeul", "Sfax", "Sidi Bouzid", "Siliana", "Sousse", "Tataouine", "Tozeur", "Tunis", "Zaghouan"], required: true },
      { name: "postalCode", label: "Postal Code", placeholder: "Enter postal code", type: "text" },
    ],
    regionLabel: "Governorate",
    postalLabel: "Postal Code"
  },
  // Qatar format
  "Qatar": {
    fields: [
      { name: "municipality", label: "Municipality", placeholder: "Select municipality", type: "select", options: ["Ad Dawhah", "Al Rayyan", "Al Wakrah", "Al Khor", "Al Shamal", "Umm Salal", "Al Daayen"], required: true },
      { name: "zone", label: "Zone", placeholder: "Enter zone", type: "text" },
    ],
    regionLabel: "Municipality",
    postalLabel: "Zone"
  },
  // Kuwait format
  "Kuwait": {
    fields: [
      { name: "governorate", label: "Governorate", placeholder: "Select governorate", type: "select", options: ["Al Ahmadi", "Al Farwaniyah", "Al Jahra", "Al Kuwait", "Hawalli", "Mubarak Al-Kabeer"], required: true },
      { name: "block", label: "Block", placeholder: "Enter block number", type: "text" },
    ],
    regionLabel: "Governorate",
    postalLabel: "Block"
  },
  // Oman format
  "Oman": {
    fields: [
      { name: "governorate", label: "Governorate", placeholder: "Select governorate", type: "select", options: ["Ad Dakhiliyah", "Ad Dhahirah", "Al Batinah North", "Al Batinah South", "Al Buraimi", "Al Wusta", "Ash Sharqiyah North", "Ash Sharqiyah South", "Dhofar", "Muscat", "Musandam"], required: true },
      { name: "postalCode", label: "Postal Code", placeholder: "Enter postal code", type: "text" },
    ],
    regionLabel: "Governorate",
    postalLabel: "Postal Code"
  },
  // Jordan format
  "Jordan": {
    fields: [
      { name: "governorate", label: "Governorate", placeholder: "Select governorate", type: "select", options: ["Amman", "Ajloun", "Al Aqabah", "Al Balqa", "Al Karak", "Al Mafraq", "At Tafilah", "Az Zarqa", "Irbid", "Jarash", "Ma'an", "Madaba"], required: true },
      { name: "postalCode", label: "Postal Code", placeholder: "Enter postal code", type: "text" },
    ],
    regionLabel: "Governorate",
    postalLabel: "Postal Code"
  },
  // Lebanon format
  "Lebanon": {
    fields: [
      { name: "governorate", label: "Governorate", placeholder: "Select governorate", type: "select", options: ["Beirut", "Mount Lebanon", "North Lebanon", "South Lebanon", "Beqaa", "Nabatieh", "Akkar", "Baalbek-Hermel"], required: true },
      { name: "district", label: "District", placeholder: "Enter district", type: "text" },
    ],
    regionLabel: "Governorate",
    postalLabel: ""
  },
  // Iran format
  "Iran": {
    fields: [
      { name: "province", label: "Province", placeholder: "Select province", type: "select", options: ["Alborz", "Ardabil", "Bushehr", "Chaharmahal and Bakhtiari", "East Azerbaijan", "Fars", "Gilan", "Golestan", "Hamadan", "Hormozgan", "Ilam", "Isfahan", "Kerman", "Kermanshah", "Khorasan North", "Khorasan Razavi", "Khorasan South", "Khuzestan", "Kohgiluyeh and Boyer-Ahmad", "Kurdistan", "Lorestan", "Markazi", "Mazandaran", "Qazvin", "Qom", "Semnan", "Sistan and Baluchestan", "Tehran", "West Azerbaijan", "Yazd", "Zanjan"], required: true },
      { name: "postalCode", label: "Postal Code", placeholder: "Enter postal code", type: "text", required: true },
    ],
    regionLabel: "Province",
    postalLabel: "Postal Code"
  },
  // Iraq format
  "Iraq": {
    fields: [
      { name: "governorate", label: "Governorate", placeholder: "Select governorate", type: "select", options: ["Baghdad", "Basra", "Dhi Qar", "Al-Qadisiyyah", "Muthanna", "Maysan", "Wasit", "Diyala", "Salahaddin", "Kirkuk", "Sulaymaniyah", "Erbil", "Duhok", "Najaf", "Karbala", "Babil", "Anbar", "Nineveh"], required: true },
      { name: "postalCode", label: "Postal Code", placeholder: "Enter postal code", type: "text" },
    ],
    regionLabel: "Governorate",
    postalLabel: "Postal Code"
  },
  // Israel format
  "Israel": {
    fields: [
      { name: "district", label: "District", placeholder: "Select district", type: "select", options: ["Jerusalem", "North", "Haifa", "Center", "Tel Aviv", "South", "Judea and Samaria"], required: true },
      { name: "postalCode", label: "Postal Code", placeholder: "Enter postal code", type: "text", required: true },
    ],
    regionLabel: "District",
    postalLabel: "Postal Code"
  },
  // Afghanistan format
  "Afghanistan": {
    fields: [
      { name: "province", label: "Province", placeholder: "Select province", type: "text", required: true },
      { name: "district", label: "District", placeholder: "Enter district", type: "text" },
    ],
    regionLabel: "Province",
    postalLabel: ""
  },
  // Sri Lanka format
  "Sri Lanka": {
    fields: [
      { name: "province", label: "Province", placeholder: "Select province", type: "select", options: ["Central", "Eastern", "North Central", "Northern", "North Western", "Sabaragamuwa", "Southern", "Uva", "Western"], required: true },
      { name: "district", label: "District", placeholder: "Enter district", type: "text" },
      { name: "postalCode", label: "Postal Code", placeholder: "Enter postal code", type: "text" },
    ],
    regionLabel: "Province",
    postalLabel: "Postal Code"
  },
  // Nepal format
  "Nepal": {
    fields: [
      { name: "province", label: "Province", placeholder: "Select province", type: "select", options: ["Province 1", "Province 2", "Bagmati", "Gandaki", "Lumbini", "Karnali", "Sudurpashchim"], required: true },
      { name: "district", label: "District", placeholder: "Enter district", type: "text" },
      { name: "postalCode", label: "Postal Code", placeholder: "Enter postal code", type: "text" },
    ],
    regionLabel: "Province",
    postalLabel: "Postal Code"
  },
  // Myanmar format
  "Myanmar": {
    fields: [
      { name: "region", label: "Region/State", placeholder: "Select region", type: "text", required: true },
      { name: "township", label: "Township", placeholder: "Enter township", type: "text" },
    ],
    regionLabel: "Region",
    postalLabel: ""
  },
  // Cambodia format
  "Cambodia": {
    fields: [
      { name: "province", label: "Province", placeholder: "Select province", type: "text", required: true },
      { name: "district", label: "District", placeholder: "Enter district", type: "text" },
      { name: "postalCode", label: "Postal Code", placeholder: "Enter postal code", type: "text" },
    ],
    regionLabel: "Province",
    postalLabel: "Postal Code"
  },
  // Laos format
  "Laos": {
    fields: [
      { name: "province", label: "Province", placeholder: "Select province", type: "text", required: true },
      { name: "district", label: "District", placeholder: "Enter district", type: "text" },
    ],
    regionLabel: "Province",
    postalLabel: ""
  },
  // Ghana format
  "Ghana": {
    fields: [
      { name: "region", label: "Region", placeholder: "Select region", type: "select", options: ["Ahafo", "Ashanti", "Bono", "Bono East", "Central", "Eastern", "Greater Accra", "North East", "Northern", "Oti", "Savannah", "Upper East", "Upper West", "Volta", "Western", "Western North"], required: true },
      { name: "district", label: "District", placeholder: "Enter district", type: "text" },
    ],
    regionLabel: "Region",
    postalLabel: ""
  },
  // Tanzania format
  "Tanzania": {
    fields: [
      { name: "region", label: "Region", placeholder: "Select region", type: "text", required: true },
      { name: "district", label: "District", placeholder: "Enter district", type: "text" },
      { name: "postalCode", label: "Postal Code", placeholder: "Enter postal code", type: "text" },
    ],
    regionLabel: "Region",
    postalLabel: "Postal Code"
  },
  // Uganda format
  "Uganda": {
    fields: [
      { name: "region", label: "Region", placeholder: "Select region", type: "select", options: ["Central", "Eastern", "Northern", "Western"], required: true },
      { name: "district", label: "District", placeholder: "Enter district", type: "text" },
    ],
    regionLabel: "Region",
    postalLabel: ""
  },
  // Zambia format
  "Zambia": {
    fields: [
      { name: "province", label: "Province", placeholder: "Select province", type: "select", options: ["Central", "Copperbelt", "Eastern", "Luapula", "Lusaka", "Muchinga", "North-Western", "Northern", "Southern", "Western"], required: true },
      { name: "district", label: "District", placeholder: "Enter district", type: "text" },
    ],
    regionLabel: "Province",
    postalLabel: ""
  },
  // Zimbabwe format
  "Zimbabwe": {
    fields: [
      { name: "province", label: "Province", placeholder: "Select province", type: "select", options: ["Bulawayo", "Harare", "Manicaland", "Mashonaland Central", "Mashonaland East", "Mashonaland West", "Masvingo", "Matabeleland North", "Matabeleland South", "Midlands"], required: true },
      { name: "district", label: "District", placeholder: "Enter district", type: "text" },
    ],
    regionLabel: "Province",
    postalLabel: ""
  },
  // Chile format
  "Chile": {
    fields: [
      { name: "region", label: "Region", placeholder: "Select region", type: "select", options: ["Arica and Parinacota", "Tarapacá", "Antofagasta", "Atacama", "Coquimbo", "Valparaíso", "Metropolitan", "O'Higgins", "Maule", "Ñuble", "Biobío", "Araucanía", "Los Ríos", "Los Lagos", "Aysén", "Magallanes"], required: true },
      { name: "postalCode", label: "Postal Code", placeholder: "Enter postal code", type: "text" },
    ],
    regionLabel: "Region",
    postalLabel: "Postal Code"
  },
  // Colombia format
  "Colombia": {
    fields: [
      { name: "department", label: "Department", placeholder: "Select department", type: "select", options: ["Amazonas", "Antioquia", "Arauca", "Atlántico", "Bolívar", "Boyacá", "Caldas", "Caquetá", "Casanare", "Cauca", "Cesar", "Chocó", "Córdoba", "Cundinamarca", "Guainía", "Guaviare", "Huila", "La Guajira", "Magdalena", "Meta", "Nariño", "Norte de Santander", "Putumayo", "Quindío", "Risaralda", "San Andrés", "Santander", "Sucre", "Tolima", "Valle del Cauca", "Vaupés", "Vichada"], required: true },
      { name: "postalCode", label: "Postal Code", placeholder: "Enter postal code", type: "text" },
    ],
    regionLabel: "Department",
    postalLabel: "Postal Code"
  },
  // Peru format
  "Peru": {
    fields: [
      { name: "region", label: "Region", placeholder: "Select region", type: "text", required: true },
      { name: "province", label: "Province", placeholder: "Enter province", type: "text" },
      { name: "district", label: "District", placeholder: "Enter district", type: "text" },
    ],
    regionLabel: "Region",
    postalLabel: ""
  },
  // Argentina format
  "Argentina": {
    fields: [
      { name: "province", label: "Province", placeholder: "Select province", type: "select", options: ["Buenos Aires", "Catamarca", "Chaco", "Chubut", "Córdoba", "Corrientes", "Entre Ríos", "Formosa", "Jujuy", "La Pampa", "La Rioja", "Mendoza", "Misiones", "Neuquén", "Río Negro", "Salta", "San Juan", "San Luis", "Santa Cruz", "Santa Fe", "Santiago del Estero", "Tierra del Fuego", "Tucumán"], required: true },
      { name: "postalCode", label: "Código Postal", placeholder: "Enter código postal", type: "text" },
    ],
    regionLabel: "Province",
    postalLabel: "Código Postal"
  },
  // Venezuela format
  "Venezuela": {
    fields: [
      { name: "state", label: "State", placeholder: "Select state", type: "text", required: true },
      { name: "postalCode", label: "Postal Code", placeholder: "Enter postal code", type: "text" },
    ],
    regionLabel: "State",
    postalLabel: "Postal Code"
  },
  // Malaysia format
  "Malaysia": {
    fields: [
      { name: "state", label: "State", placeholder: "Select state", type: "select", options: ["Johor", "Kedah", "Kelantan", "Kuala Lumpur", "Labuan", "Malacca", "Negeri Sembilan", "Pahang", "Penang", "Perak", "Perlis", "Putrajaya", "Sabah", "Sarawak", "Selangor", "Terengganu"], required: true },
      { name: "postalCode", label: "Postal Code", placeholder: "Enter postal code", type: "text", required: true },
    ],
    regionLabel: "State",
    postalLabel: "Postal Code"
  },
  // Singapore format
  "Singapore": {
    fields: [
      { name: "postalCode", label: "Postal Code", placeholder: "Enter postal code", type: "text", required: true },
    ],
    regionLabel: "",
    postalLabel: "Postal Code"
  },
};

// Default address format for countries not specifically defined
export const defaultAddressFormat: AddressFormatConfig = {
  fields: [
    { name: "region", label: "Region/State", placeholder: "Enter region or state", type: "text" },
    { name: "postalCode", label: "Postal Code", placeholder: "Enter postal code", type: "text" },
  ],
  regionLabel: "Region",
  postalLabel: "Postal Code"
};

// Helper function to get address format for a country
export function getAddressFormat(country: string): AddressFormatConfig {
  return addressFormats[country] || defaultAddressFormat;
}

// Helper function to get cities for a country
export function getCitiesForCountry(country: string): string[] {
  return countriesWithCities[country] || [];
}

// Blood types
export const bloodTypes = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

// Marital status options
export const maritalStatuses = [
  "Single", "Married", "Divorced", "Widowed", "Separated", "Domestic Partnership", "Civil Union"
];

// Gender options
export const genders = [
  "Male", "Female", "Other", "Prefer not to say"
];

// Relationship options for emergency contacts
export const relationshipOptions = [
  "Spouse", "Partner", "Parent", "Child", "Sibling", "Grandparent", "Grandchild",
  "Aunt/Uncle", "Cousin", "Friend", "Neighbor", "Colleague", "Caregiver", "Other"
];

// Phone types
export const phoneTypes = ["Mobile", "Home", "Work", "Other"];

// Title/Prefix options
export const titleOptions = ["Mr.", "Mrs.", "Ms.", "Miss", "Dr.", "Prof.", "Rev.", "Other"];

// Identification Document Types - comprehensive list for patient registration
export const identificationDocumentTypes = [
  { value: "national_id", label: "National ID Card", description: "Government-issued national identity card" },
  { value: "passport", label: "Passport", description: "International travel document" },
  { value: "residence_permit", label: "Residence Permit", description: "Resident/Permanent residence card" },
  { value: "drivers_license", label: "Driver's License", description: "Government-issued driving permit" },
  { value: "work_permit", label: "Work Permit", description: "Employment authorization document" },
  { value: "refugee_id", label: "Refugee ID", description: "Refugee identification document" },
  { value: "national_health_id", label: "National Health ID", description: "Government health insurance card" },
  { value: "social_security", label: "Social Security Number", description: "Social security/tax ID number" },
  { value: "military_id", label: "Military ID", description: "Military identification card" },
  { value: "student_id", label: "Student ID", description: "Educational institution ID card" },
  { value: "employee_id", label: "Employee ID", description: "Company/organization employee card" },
  { value: "voter_id", label: "Voter ID Card", description: "Voter registration card" },
  { value: "birth_certificate", label: "Birth Certificate", description: "Official birth record document" },
  { value: "other", label: "Other", description: "Other identification document" },
];

// Legacy support - simple array for backward compatibility
export const idTypes = identificationDocumentTypes.map(t => t.label);

// ID types for dropdown (simple list)
export const idTypeOptions = identificationDocumentTypes.map(t => t.value);

// Organ donor status
export const organDonorOptions = ["Yes", "No", "Not Specified"];

// Preferred contact methods
export const contactMethods = ["Phone", "Email", "SMS", "WhatsApp", "Mail"];

// Insurance status
export const insuranceStatusOptions = ["Verified", "Pending", "Not Insured"];

// ============================================
// MEDICAL DATA - Drug Allergies, Conditions
// ============================================

// Common Drug Allergies - comprehensive list
export const drugAllergies = [
  // Antibiotics
  "Penicillin", "Amoxicillin", "Ampicillin", "Cephalosporins", "Cephalexin", "Ceftriaxone",
  "Sulfonamides", "Sulfa drugs", "Trimethoprim-Sulfamethoxazole", "Bactrim",
  "Macrolides", "Erythromycin", "Azithromycin", "Clarithromycin",
  "Tetracycline", "Doxycycline", "Minocycline",
  "Fluoroquinolones", "Ciprofloxacin", "Levofloxacin", "Moxifloxacin",
  "Vancomycin", "Metronidazole", "Clindamycin", "Nitrofurantoin",
  // NSAIDs and Pain Medications
  "Aspirin", "Ibuprofen", "Naproxen", "Diclofenac", "Celecoxib", "Meloxicam",
  "Acetaminophen", "Paracetamol", "Codeine", "Morphine", "Oxycodone", "Tramadol",
  // Anesthetics
  "Lidocaine", "Bupivacaine", "Propofol", "Ketamine", "Succinylcholine",
  "Latex", "Contrast dye", "Iodine",
  // Cardiovascular
  "ACE inhibitors", "Lisinopril", "Enalapril", "ARBs", "Losartan",
  "Beta blockers", "Metoprolol", "Atenolol", "Calcium channel blockers",
  "Statins", "Atorvastatin", "Simvastatin", "Warfarin", "Heparin", "Clopidogrel",
  // Psychiatric
  "SSRIs", "Fluoxetine", "Sertraline", "Benzodiazepines", "Diazepam", "Lorazepam",
  "Lithium", "Antipsychotics", "Olanzapine", "Quetiapine",
  // Anticonvulsants
  "Phenytoin", "Carbamazepine", "Valproic acid", "Lamotrigine", "Gabapentin",
  // Hormones and Diabetes
  "Insulin", "Metformin", "Sulfonylureas", "Glipizide", "Levothyroxine",
  // Biologics and Immunotherapy
  "Monoclonal antibodies", "Infliximab", "Adalimumab", "Etanercept",
  "Chemotherapy agents", "Cisplatin", "Carboplatin", "Paclitaxel",
  // Vaccines
  "Influenza vaccine", "Hepatitis B vaccine", "MMR vaccine", "Pneumococcal vaccine",
  // Other common
  "Allopurinol", "Colchicine", "Methotrexate", "Cyclosporine",
  "Antiretrovirals", "Acyclovir", "Valacyclovir"
];

// Food and Environmental Allergies
export const otherAllergies = [
  // Food allergies
  "Peanuts", "Tree nuts", "Almonds", "Cashews", "Walnuts",
  "Milk", "Dairy", "Lactose", "Eggs", "Soy", "Wheat", "Gluten",
  "Shellfish", "Shrimp", "Crab", "Lobster", "Fish",
  "Sesame", "Mustard", "Celery", "Sulfites", "MSG",
  // Environmental
  "Pollen", "Dust mites", "Pet dander", "Cat dander", "Dog dander",
  "Mold", "Cockroaches", "Bee stings", "Wasp stings",
  "Poison ivy", "Poison oak", "Nickel", "Fragrances", "Preservatives",
  // Other
  "Eggs (vaccine)", "Gelatin", "Latex products"
];

// Critical Transmissible Conditions
export const transmissibleConditions = [
  // Blood-borne
  "HIV/AIDS", "Hepatitis B", "Hepatitis C", "Hepatitis D",
  // Respiratory
  "Tuberculosis (Active)", "Tuberculosis (Latent)", "COVID-19",
  "Influenza", "Pneumonia", "MRSA", "VRE",
  // Sexually Transmitted
  "Syphilis", "Gonorrhea", "Chlamydia", "Herpes Simplex", "HPV",
  // Vector-borne
  "Malaria", "Dengue Fever", "Zika Virus", "West Nile Virus",
  // Parasitic
  "Intestinal parasites", "Scabies", "Lice",
  // Other
  "Creutzfeldt-Jakob Disease", "Ebola", "Marburg Virus"
];

// Chronic Conditions - comprehensive list
export const chronicConditionsList = [
  // Cardiovascular
  "Hypertension", "Coronary Artery Disease", "Heart Failure", "Arrhythmia",
  "Atrial Fibrillation", "Cardiomyopathy", "Peripheral Vascular Disease",
  "Hyperlipidemia", "Atherosclerosis",
  // Endocrine/Metabolic
  "Diabetes Type 1", "Diabetes Type 2", "Prediabetes", "Thyroid Disorder",
  "Hypothyroidism", "Hyperthyroidism", "Obesity", "Metabolic Syndrome",
  "Polycystic Ovary Syndrome (PCOS)", "Cushing's Syndrome",
  // Respiratory
  "Asthma", "COPD", "Emphysema", "Chronic Bronchitis", "Pulmonary Fibrosis",
  "Sleep Apnea", "Pulmonary Hypertension",
  // Neurological
  "Epilepsy", "Seizure Disorder", "Migraine", "Parkinson's Disease",
  "Multiple Sclerosis", "Alzheimer's Disease", "Dementia", "Stroke History",
  "Neuropathy", "Myasthenia Gravis",
  // Musculoskeletal
  "Rheumatoid Arthritis", "Osteoarthritis", "Osteoporosis", "Gout",
  "Lupus (SLE)", "Fibromyalgia", "Chronic Back Pain", "Scoliosis",
  // Gastrointestinal
  "GERD", "Peptic Ulcer Disease", "Inflammatory Bowel Disease", "Crohn's Disease",
  "Ulcerative Colitis", "Irritable Bowel Syndrome", "Celiac Disease",
  "Liver Disease", "Cirrhosis", "Hepatitis (Chronic)",
  // Renal/Genitourinary
  "Chronic Kidney Disease", "Kidney Failure", "Dialysis", "Polycystic Kidney Disease",
  // Mental Health
  "Depression", "Anxiety Disorder", "Bipolar Disorder", "Schizophrenia",
  "PTSD", "OCD", "ADHD", "Autism Spectrum Disorder",
  // Hematologic
  "Anemia", "Sickle Cell Disease", "Thalassemia", "Hemophilia",
  "Deep Vein Thrombosis", "Pulmonary Embolism",
  // Oncology
  "Cancer (Active)", "Cancer (Remission)", "Leukemia", "Lymphoma",
  // Immunologic
  "HIV/AIDS", "Immunodeficiency", "Autoimmune Disorder",
  // Other
  "Glaucoma", "Cataracts", "Macular Degeneration", "Hearing Loss"
];

// Pregnancy status options
export const pregnancyStatusOptions = [
  "Not Pregnant",
  "Currently Pregnant",
  "Postpartum (<6 weeks)",
  "Breastfeeding",
  "Not Applicable",
  "Unknown"
];

// Pregnancy trimester options
export const trimesterOptions = [
  "First Trimester (1-12 weeks)",
  "Second Trimester (13-26 weeks)",
  "Third Trimester (27-40 weeks)",
  "Full Term (37+ weeks)"
];

// Insurance providers - common global providers
export const insuranceProviders = [
  "Self-Pay (No Insurance)",
  "Government Insurance",
  "Employer-Sponsored Insurance",
  "Private Insurance",
  "National Health Service",
  "Social Health Insurance",
  "Community-Based Health Insurance",
  "Other"
];
