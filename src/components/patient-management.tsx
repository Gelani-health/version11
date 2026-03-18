"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Search,
  Plus,
  Filter,
  MoreVertical,
  Phone,
  Mail,
  Calendar,
  User,
  Heart,
  Activity,
  AlertCircle,
  Eye,
  Edit,
  Trash2,
  FileText,
  Stethoscope,
  Loader2,
  Users,
  Mic,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { MedASRInput } from "@/components/medasr-input";
import { PatientRegistrationCard } from "@/components/patient-registration-card";

// Voice-enabled input component with optional voice recording
interface VoiceEnabledFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  context?: string;
  multiline?: boolean;
  disabled?: boolean;
  required?: boolean;
}

function VoiceEnabledField({
  label,
  value,
  onChange,
  placeholder,
  context = "general",
  multiline = false,
  disabled = false,
  required = false,
}: VoiceEnabledFieldProps) {
  const [showVoiceInput, setShowVoiceInput] = useState(false);
  
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{label}{required && <span className="text-red-500 ml-1">*</span>}</Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 px-2"
          onClick={() => setShowVoiceInput(!showVoiceInput)}
          disabled={disabled}
          title="Toggle voice input"
        >
          <Mic className={`h-3.5 w-3.5 ${showVoiceInput ? "text-emerald-500" : "text-slate-400"}`} />
        </Button>
      </div>
      {showVoiceInput ? (
        <MedASRInput
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          context={context}
          disabled={disabled}
          multiline={multiline}
          appendMode={multiline}
        />
      ) : multiline ? (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          rows={2}
        />
      ) : (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
        />
      )}
    </div>
  );
}

interface Patient {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  dateOfBirth: string;
  gender: string;
  bloodType?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  allergies?: string;
  chronicConditions?: string;
  emergencyContactName?: string;
  emergencyContactRelation?: string;
  emergencyContactPhone?: string;
  createdAt: string;
  consultations?: Consultation[];
  medications?: Medication[];
}

interface Consultation {
  id: string;
  consultationDate: string;
  chiefComplaint?: string;
  status: string;
}

interface Medication {
  id: string;
  medicationName: string;
  dosage?: string;
  status: string;
}

interface PatientManagementProps {
  onNavigate?: (moduleId: string, patientId?: string) => void;
}

// Country to Cities Mapping - Major cities for each country
const countryCitiesMap: Record<string, string[]> = {
  "Afghanistan": ["Kabul", "Kandahar", "Herat", "Mazar-i-Sharif", "Jalalabad"],
  "Albania": ["Tirana", "Durrës", "Vlorë", "Shkodër", "Fier"],
  "Algeria": ["Algiers", "Oran", "Constantine", "Annaba", "Blida"],
  "Andorra": ["Andorra la Vella", "Escaldes-Engordany", "Encamp", "Sant Julià de Lòria"],
  "Angola": ["Luanda", "Huambo", "Lobito", "Benguela", "Luanda"],
  "Antigua and Barbuda": ["St. John's", "All Saints", "Liberta", "Bolans"],
  "Argentina": ["Buenos Aires", "Córdoba", "Rosario", "Mendoza", "La Plata", "Mar del Plata"],
  "Armenia": ["Yerevan", "Gyumri", "Vanadzor", "Vagharshapat", "Abovyan"],
  "Australia": ["Sydney", "Melbourne", "Brisbane", "Perth", "Adelaide", "Canberra", "Gold Coast"],
  "Austria": ["Vienna", "Graz", "Linz", "Salzburg", "Innsbruck", "Klagenfurt"],
  "Azerbaijan": ["Baku", "Ganja", "Sumqayit", "Lankaran", "Mingachevir"],
  "Bahamas": ["Nassau", "Freeport", "West End", "Cooper's Town"],
  "Bahrain": ["Manama", "Riffa", "Muharraq", "Hamad Town", "Isa Town"],
  "Bangladesh": ["Dhaka", "Chittagong", "Khulna", "Rajshahi", "Sylhet", "Comilla"],
  "Barbados": ["Bridgetown", "Speightstown", "Oistins", "Bathsheba"],
  "Belarus": ["Minsk", "Gomel", "Mogilev", "Vitebsk", "Grodno", "Brest"],
  "Belgium": ["Brussels", "Antwerp", "Ghent", "Charleroi", "Liège", "Bruges"],
  "Belize": ["Belize City", "San Ignacio", "Belmopan", "Orange Walk", "Dangriga"],
  "Benin": ["Cotonou", "Porto-Novo", "Parakou", "Djougou", "Bohicon"],
  "Bhutan": ["Thimphu", "Phuntsholing", "Paro", "Samdrup Jongkhar", "Gelephu"],
  "Bolivia": ["La Paz", "Santa Cruz de la Sierra", "Cochabamba", "Sucre", "Oruro"],
  "Bosnia and Herzegovina": ["Sarajevo", "Banja Luka", "Tuzla", "Zenica", "Mostar"],
  "Botswana": ["Gaborone", "Francistown", "Molepolole", "Serowe", "Maun"],
  "Brazil": ["São Paulo", "Rio de Janeiro", "Brasília", "Salvador", "Fortaleza", "Belo Horizonte", "Manaus"],
  "Brunei": ["Bandar Seri Begawan", "Kuala Belait", "Seria", "Tutong", "Bangar"],
  "Bulgaria": ["Sofia", "Plovdiv", "Varna", "Burgas", "Ruse", "Stara Zagora"],
  "Burkina Faso": ["Ouagadougou", "Bobo-Dioulasso", "Koudougou", "Ouahigouya", "Kaya"],
  "Burundi": ["Bujumbura", "Gitega", "Muyinga", "Ngozi", "Ruyigi"],
  "Cabo Verde": ["Praia", "Mindelo", "Santa Maria", "Cidade Velha"],
  "Cambodia": ["Phnom Penh", "Siem Reap", "Battambang", "Sihanoukville", "Kampong Cham"],
  "Cameroon": ["Douala", "Yaoundé", "Garoua", "Bamenda", "Maroua", "Bafoussam"],
  "Canada": ["Toronto", "Montreal", "Vancouver", "Calgary", "Edmonton", "Ottawa", "Winnipeg", "Quebec City"],
  "Central African Republic": ["Bangui", "Bimbo", "Berbérati", "Kaga Bandoro", "Bozoum"],
  "Chad": ["N'Djamena", "Moundou", "Sarh", "Abéché", "Kélo"],
  "Chile": ["Santiago", "Valparaíso", "Concepción", "La Serena", "Antofagasta", "Temuco"],
  "China": ["Shanghai", "Beijing", "Guangzhou", "Shenzhen", "Chengdu", "Chongqing", "Wuhan", "Xi'an", "Hangzhou"],
  "Colombia": ["Bogotá", "Medellín", "Cali", "Barranquilla", "Cartagena", "Bucaramanga"],
  "Comoros": ["Moroni", "Mutsamudu", "Fomboni", "Domoni"],
  "Congo": ["Brazzaville", "Pointe-Noire", "Dolisie", "Nkayi", "Impfondo"],
  "Congo (Democratic Republic)": ["Kinshasa", "Lubumbashi", "Mbuji-Mayi", "Kananga", "Kisangani", "Goma"],
  "Costa Rica": ["San José", "Limón", "San Francisco", "Alajuela", "Liberia", "Puntarenas"],
  "Croatia": ["Zagreb", "Split", "Rijeka", "Osijek", "Zadar", "Pula"],
  "Cuba": ["Havana", "Santiago de Cuba", "Camagüey", "Holguín", "Santa Clara", "Cienfuegos"],
  "Cyprus": ["Nicosia", "Limassol", "Larnaca", "Paphos", "Famagusta"],
  "Czech Republic": ["Prague", "Brno", "Ostrava", "Plzeň", "Liberec", "Olomouc"],
  "Denmark": ["Copenhagen", "Aarhus", "Odense", "Aalborg", "Esbjerg", "Randers"],
  "Djibouti": ["Djibouti City", "Ali Sabieh", "Tadjoura", "Obock", "Dikhil"],
  "Dominica": ["Roseau", "Portsmouth", "Marigot", "Mahaut"],
  "Dominican Republic": ["Santo Domingo", "Santiago de los Caballeros", "Santo Domingo Este", "La Romana", "San Pedro de Macorís"],
  "East Timor": ["Dili", "Baucau", "Maliana", "Suai", "Lospalos"],
  "Ecuador": ["Quito", "Guayaquil", "Cuenca", "Santo Domingo", "Machala", "Durán"],
  "Egypt": ["Cairo", "Alexandria", "Giza", "Shubra El-Kheima", "Port Said", "Suez", "Luxor"],
  "El Salvador": ["San Salvador", "Santa Ana", "San Miguel", "Soyapango", "Santa Tecla"],
  "Equatorial Guinea": ["Malabo", "Bata", "Ebebiyin", "Mongomo", "Evinayong"],
  "Eritrea": ["Asmara", "Keren", "Massawa", "Assab", "Mendefera", "Adi Keyh"],
  "Estonia": ["Tallinn", "Tartu", "Narva", "Pärnu", "Kohtla-Järve", "Viljandi"],
  "Eswatini": ["Mbabane", "Manzini", "Lobamba", "Siteki", "Mankayane"],
  "Ethiopia": ["Addis Ababa", "Dire Dawa", "Mekelle", "Gondar", "Bahir Dar", "Jimma", "Dessie", "Hawassa", "Adama", "Harar", "Jijiga", "Shashamane", "Debre Markos", "Debre Birhan", "Nekemte", "Arba Minch", "Wolisso", "Hosaena", "Kombolcha", "Sodo"],
  "Fiji": ["Suva", "Lautoka", "Nadi", "Labasa", "Savusavu"],
  "Finland": ["Helsinki", "Espoo", "Tampere", "Vantaa", "Turku", "Oulu", "Lahti"],
  "France": ["Paris", "Marseille", "Lyon", "Toulouse", "Nice", "Nantes", "Strasbourg", "Montpellier", "Bordeaux"],
  "Gabon": ["Libreville", "Port-Gentil", "Franceville", "Oyem", "Moanda"],
  "Gambia": ["Banjul", "Serekunda", "Brikama", "Bakau", "Farafenni"],
  "Georgia": ["Tbilisi", "Batumi", "Kutaisi", "Rustavi", "Zugdidi", "Gori"],
  "Germany": ["Berlin", "Hamburg", "Munich", "Cologne", "Frankfurt", "Stuttgart", "Düsseldorf", "Dortmund", "Essen", "Leipzig"],
  "Ghana": ["Accra", "Kumasi", "Tamale", "Takoradi", "Cape Coast", "Sekondi-Takoradi"],
  "Greece": ["Athens", "Thessaloniki", "Patras", "Heraklion", "Larissa", "Volos"],
  "Grenada": ["St. George's", "Gouyave", "Grenville", "Sauteurs"],
  "Guatemala": ["Guatemala City", "Mixco", "Villa Nueva", "Quetzaltenango", "Escuintla", "Chimaltenango"],
  "Guinea": ["Conakry", "Nzérékoré", "Kankan", "Kindia", "Boké", "Fria"],
  "Guinea-Bissau": ["Bissau", "Bafatá", "Gabú", "Bissorã", "Bolama"],
  "Guyana": ["Georgetown", "Linden", "New Amsterdam", "Anna Regina", "Bartica"],
  "Haiti": ["Port-au-Prince", "Cap-Haïtien", "Gonaïves", "Les Cayes", "Jacmel", "Port-de-Paix"],
  "Honduras": ["Tegucigalpa", "San Pedro Sula", "Choloma", "La Ceiba", "El Progreso", "Choluteca"],
  "Hungary": ["Budapest", "Debrecen", "Szeged", "Miskolc", "Pécs", "Győr"],
  "Iceland": ["Reykjavík", "Kópavogur", "Hafnarfjörður", "Akureyri", "Reykjanesbær"],
  "India": ["Mumbai", "Delhi", "Bangalore", "Chennai", "Kolkata", "Hyderabad", "Ahmedabad", "Pune", "Jaipur", "Lucknow", "Kanpur"],
  "Indonesia": ["Jakarta", "Surabaya", "Bandung", "Medan", "Semarang", "Makassar", "Palembang", "Depok"],
  "Iran": ["Tehran", "Mashhad", "Isfahan", "Karaj", "Shiraz", "Tabriz", "Qom"],
  "Iraq": ["Baghdad", "Basra", "Mosul", "Erbil", "Sulaymaniyah", "Kirkuk", "Najaf"],
  "Ireland": ["Dublin", "Cork", "Limerick", "Galway", "Waterford", "Drogheda", "Dundalk"],
  "Israel": ["Jerusalem", "Tel Aviv", "Haifa", "Rishon LeZion", "Petah Tikva", "Ashdod", "Netanya"],
  "Italy": ["Rome", "Milan", "Naples", "Turin", "Palermo", "Genoa", "Bologna", "Florence", "Venice"],
  "Ivory Coast": ["Abidjan", "Bouaké", "Yamoussoukro", "Daloa", "San-Pédro", "Korhogo"],
  "Jamaica": ["Kingston", "Spanish Town", "Portmore", "Montego Bay", "Mandeville", "Ocho Ríos"],
  "Japan": ["Tokyo", "Yokohama", "Osaka", "Nagoya", "Sapporo", "Fukuoka", "Kobe", "Kyoto", "Kawasaki"],
  "Jordan": ["Amman", "Zarqa", "Irbid", "Aqaba", "Salt", "Mafraq"],
  "Kazakhstan": ["Almaty", "Nur-Sultan", "Shymkent", "Aktobe", "Karaganda", "Taraz", "Pavlodar"],
  "Kenya": ["Nairobi", "Mombasa", "Kisumu", "Nakuru", "Eldoret", "Kisii", "Malindi"],
  "Kiribati": ["South Tarawa", "Betio", "Bikenibeu", "London", "Kuria"],
  "Kosovo": ["Pristina", "Prizren", "Ferizaj", "Peć", "Gjakova", "Gjilan"],
  "Kuwait": ["Kuwait City", "Al Ahmadi", "Hawalli", "Farwaniya", "Jahra", "Mubarak Al-Kabeer"],
  "Kyrgyzstan": ["Bishkek", "Osh", "Jalal-Abad", "Karakol", "Tokmok", "Uzgen"],
  "Laos": ["Vientiane", "Pakse", "Savannakhet", "Luang Prabang", "Xam Neua", "Thakhek"],
  "Latvia": ["Riga", "Daugavpils", "Liepāja", "Jelgava", "Jūrmala", "Ventspils"],
  "Lebanon": ["Beirut", "Tripoli", "Sidon", "Tyre", "Nabatieh", "Baalbek", "Jounieh"],
  "Lesotho": ["Maseru", "Teyateyaneng", "Mafeteng", "Hlotse", "Mohale's Hoek"],
  "Liberia": ["Monrovia", "Gbarnga", "Kakata", "Bensonville", "Harper", "Buchanan"],
  "Libya": ["Tripoli", "Benghazi", "Misrata", "Bayda", "Zawiya", "Sabha"],
  "Liechtenstein": ["Vaduz", "Schaan", "Balzers", "Triesen", "Eschen", "Mauren"],
  "Lithuania": ["Vilnius", "Kaunas", "Klaipėda", "Šiauliai", "Panevėžys", "Alytus"],
  "Luxembourg": ["Luxembourg City", "Esch-sur-Alzette", "Differdange", "Dudelange", "Ettelbruck"],
  "Madagascar": ["Antananarivo", "Toamasina", "Antsirabe", "Mahajanga", "Fianarantsoa", "Toliara"],
  "Malawi": ["Lilongwe", "Blantyre", "Mzuzu", "Zomba", "Karonga", "Kasungu"],
  "Malaysia": ["Kuala Lumpur", "George Town", "Ipoh", "Johor Bahru", "Kota Kinabalu", "Kuching", "Malacca City"],
  "Maldives": ["Malé", "Addu City", "Fuvahmulah", "Kulhudhuffushi", "Thinadhoo"],
  "Mali": ["Bamako", "Sikasso", "Mopti", "Koutiala", "Ségou", "Kayes", "Gao"],
  "Malta": ["Valletta", "Birkirkara", "Mosta", "Rabat", "St. Paul's Bay", "Qormi"],
  "Marshall Islands": ["Majuro", "Ebeye", "Arno", "Jaluit", "Wotho"],
  "Mauritania": ["Nouakchott", "Nouadhibou", "Kaédi", "Kiffa", "Néma", "Rosso"],
  "Mauritius": ["Port Louis", "Beau Bassin-Rose Hill", "Vacoas-Phoenix", "Curepipe", "Quatre Bornes"],
  "Mexico": ["Mexico City", "Guadalajara", "Monterrey", "Puebla", "Tijuana", "León", "Ciudad Juárez", "Mérida"],
  "Micronesia": ["Palikir", "Weno", "Kolonia", "Tofol", "Lelu"],
  "Moldova": ["Chișinău", "Tiraspol", "Bălți", "Bender", "Ribnița", "Cahul"],
  "Monaco": ["Monte Carlo", "La Condamine", "Fontvieille", "Le Portier"],
  "Mongolia": ["Ulaanbaatar", "Erdenet", "Darkhan", "Choibalsan", "Mörön", "Khovd"],
  "Montenegro": ["Podgorica", "Nikšić", "Pljevlja", "Bijelo Polje", "Cetinje", "Bar"],
  "Morocco": ["Casablanca", "Rabat", "Marrakech", "Fes", "Tangier", "Agadir", "Meknes", "Oujda"],
  "Mozambique": ["Maputo", "Matola", "Beira", "Nampula", "Chimoio", "Tete", "Quelimane"],
  "Myanmar": ["Yangon", "Mandalay", "Naypyidaw", "Mawlamyine", "Bago", "Taunggyi", "Monywa"],
  "Namibia": ["Windhoek", "Rundu", "Walvis Bay", "Swakopmund", "Oshakati", "Rehoboth"],
  "Nauru": ["Yaren", "Denigomodu", "Meneng", "Boe", "Aiwo"],
  "Nepal": ["Kathmandu", "Pokhara", "Lalitpur", "Biratnagar", "Birgunj", "Bharatpur", "Birganj"],
  "Netherlands": ["Amsterdam", "Rotterdam", "The Hague", "Utrecht", "Eindhoven", "Groningen", "Tilburg", "Almere"],
  "New Zealand": ["Auckland", "Wellington", "Christchurch", "Hamilton", "Tauranga", "Dunedin", "Palmerston North"],
  "Nicaragua": ["Managua", "León", "Masaya", "Granada", "Estelí", "Chinandega", "Matagalpa"],
  "Niger": ["Niamey", "Zinder", "Maradi", "Agadez", "Tahoua", "Dosso", "Diffa"],
  "Nigeria": ["Lagos", "Kano", "Ibadan", "Abuja", "Port Harcourt", "Kaduna", "Benin City", "Maiduguri"],
  "North Korea": ["Pyongyang", "Hamhung", "Chongjin", "Nampo", "Wonsan", "Sinuiju"],
  "North Macedonia": ["Skopje", "Bitola", "Kumanovo", "Prilep", "Tetovo", "Ohrid", "Gostivar"],
  "Norway": ["Oslo", "Bergen", "Trondheim", "Stavanger", "Drammen", "Fredrikstad", "Kristiansand"],
  "Oman": ["Muscat", "Seeb", "Salalah", "Sohar", "Nizwa", "Sur", "Ibri"],
  "Pakistan": ["Karachi", "Lahore", "Faisalabad", "Rawalpindi", "Islamabad", "Peshawar", "Multan", "Quetta"],
  "Palau": ["Ngerulmud", "Koror", "Airai", "Peleliu", "Angaur"],
  "Palestine": ["Gaza City", "Ramallah", "Hebron", "Nablus", "Bethlehem", "Jenin", "Khan Yunis"],
  "Panama": ["Panama City", "San Miguelito", "Tocumen", "David", "Colón", "La Chorrera"],
  "Papua New Guinea": ["Port Moresby", "Lae", "Arawa", "Mount Hagen", "Madang", "Wewak", "Goroka"],
  "Paraguay": ["Asunción", "Ciudad del Este", "San Lorenzo", "Luque", "Capiatá", "Lambaré", "Fernando de la Mora"],
  "Peru": ["Lima", "Arequipa", "Trujillo", "Chiclayo", "Piura", "Iquitos", "Cusco", "Huancayo"],
  "Philippines": ["Manila", "Quezon City", "Davao City", "Cebu City", "Zamboanga City", "Antipolo", "Pasig"],
  "Poland": ["Warsaw", "Kraków", "Łódź", "Wrocław", "Poznań", "Gdańsk", "Szczecin", "Bydgoszcz"],
  "Portugal": ["Lisbon", "Porto", "Amadora", "Braga", "Coimbra", "Funchal", "Setúbal", "Aveiro"],
  "Qatar": ["Doha", "Al Rayyan", "Al Wakrah", "Al Khor", "Dukhan", "Mesaieed"],
  "Romania": ["Bucharest", "Cluj-Napoca", "Timișoara", "Iași", "Constanța", "Craiova", "Brașov", "Galați"],
  "Russia": ["Moscow", "Saint Petersburg", "Novosibirsk", "Yekaterinburg", "Kazan", "Nizhny Novgorod", "Samara", "Omsk"],
  "Rwanda": ["Kigali", "Butare", "Gitarama", "Ruhengeri", "Gisenyi", "Byumba", "Cyangugu"],
  "Saint Kitts and Nevis": ["Basseterre", "Charlestown", "Sandy Point", "Dieppe Bay Town", "Cayon"],
  "Saint Lucia": ["Castries", "Vieux Fort", "Soufrière", "Gros Islet", "Dennery"],
  "Saint Vincent and the Grenadines": ["Kingstown", "Georgetown", "Byera Village", "Layou", "Barrouallie"],
  "Samoa": ["Apia", "Vaitele", "Faleula", "Siusega", "Malie", "Faleasi'u"],
  "San Marino": ["San Marino", "Serravalle", "Borgo Maggiore", "Domagnano", "Fiorentino"],
  "Sao Tome and Principe": ["São Tomé", "Santo António", "Neves", "Trindade", "Santa Cruz"],
  "Saudi Arabia": ["Riyadh", "Jeddah", "Mecca", "Medina", "Dammam", "Khobar", "Dhahran", "Tabuk"],
  "Senegal": ["Dakar", "Touba", "Thiès", "Saint-Louis", "Kaolack", "Ziguinchor", "Rufisque"],
  "Serbia": ["Belgrade", "Novi Sad", "Niš", "Kragujevac", "Subotica", "Leskovac", "Kruševac"],
  "Seychelles": ["Victoria", "Anse Boileau", "Beau Vallon", "Cascade", "Takamaka"],
  "Sierra Leone": ["Freetown", "Bo", "Kenema", "Makeni", "Koidu", "Port Loko", "Kabala"],
  "Singapore": ["Singapore City", "Woodlands", "Tampines", "Jurong West", "Sengkang", "Hougang"],
  "Slovakia": ["Bratislava", "Košice", "Prešov", "Žilina", "Nitra", "Banská Bystrica", "Trnava"],
  "Slovenia": ["Ljubljana", "Maribor", "Celje", "Kranj", "Velenje", "Koper", "Novo Mesto"],
  "Solomon Islands": ["Honiara", "Gizo", "Auki", "Kirakira", "Tulagi"],
  "Somalia": ["Mogadishu", "Hargeisa", "Bosaso", "Galkayo", "Kismayo", "Baidoa", "Burao"],
  "South Africa": ["Johannesburg", "Cape Town", "Durban", "Pretoria", "Port Elizabeth", "Bloemfontein", "East London"],
  "South Korea": ["Seoul", "Busan", "Incheon", "Daegu", "Daejeon", "Gwangju", "Suwon", "Ulsan"],
  "South Sudan": ["Juba", "Malakal", "Wau", "Yei", "Bor", "Rumbek", "Aweil"],
  "Spain": ["Madrid", "Barcelona", "Valencia", "Seville", "Zaragoza", "Málaga", "Bilbao", "Alicante"],
  "Sri Lanka": ["Colombo", "Dehiwala-Mount Lavinia", "Moratuwa", "Kandy", "Jaffna", "Negombo", "Galle"],
  "Sudan": ["Khartoum", "Omdurman", "Port Sudan", "Kassala", "El Obeid", "Nyala", "Al-Fashir"],
  "Suriname": ["Paramaribo", "Lelydorp", "Nieuw Nickerie", "Moengo", "Albina"],
  "Sweden": ["Stockholm", "Gothenburg", "Malmö", "Uppsala", "Linköping", "Örebro", "Västerås"],
  "Switzerland": ["Zurich", "Geneva", "Basel", "Lausanne", "Bern", "Winterthur", "Lucerne", "St. Gallen"],
  "Syria": ["Damascus", "Aleppo", "Homs", "Latakia", "Hama", "Tartus", "Deir ez-Zor"],
  "Taiwan": ["Taipei", "New Taipei", "Kaohsiung", "Taichung", "Tainan", "Taoyuan", "Hsinchu"],
  "Tajikistan": ["Dushanbe", "Khujand", "Kulob", "Qurghonteppa", "Istaravshan", "Kanibadam"],
  "Tanzania": ["Dar es Salaam", "Mwanza", "Arusha", "Dodoma", "Mbeya", "Morogoro", "Tanga", "Zanzibar City"],
  "Thailand": ["Bangkok", "Nonthaburi", "Pak Kret", "Hat Yai", "Chiang Mai", "Nakhon Ratchasima", "Pattaya"],
  "Togo": ["Lomé", "Sokodé", "Kara", "Kpalimé", "Atakpamé", "Dapaong", "Tsévié"],
  "Tonga": ["Nuku'alofa", "Neiafu", "Haveluloto", "Vaini", "Pangai"],
  "Trinidad and Tobago": ["Port of Spain", "Chaguanas", "San Fernando", "Arima", "Couva", "Point Fortin"],
  "Tunisia": ["Tunis", "Sfax", "Sousse", "Kairouan", "Gabès", "Bizerte", "Ariana"],
  "Turkey": ["Istanbul", "Ankara", "Izmir", "Bursa", "Adana", "Gaziantep", "Konya", "Antalya"],
  "Turkmenistan": ["Ashgabat", "Türkmenabat", "Daşoguz", "Mary", "Balkanabat", "Tejen"],
  "Tuvalu": ["Funafuti", "Alapi", "Senala", "Fakaofo", "Nukufetau"],
  "Uganda": ["Kampala", "Gulu", "Lira", "Mbarara", "Jinja", "Mbale", "Entebbe", "Arua"],
  "Ukraine": ["Kyiv", "Kharkiv", "Odesa", "Dnipro", "Donetsk", "Zaporizhzhia", "Lviv", "Kryvyi Rih"],
  "United Arab Emirates": ["Dubai", "Abu Dhabi", "Sharjah", "Al Ain", "Ajman", "Ras Al Khaimah", "Fujairah"],
  "United Kingdom": ["London", "Birmingham", "Manchester", "Leeds", "Glasgow", "Liverpool", "Newcastle", "Sheffield"],
  "United States": ["New York", "Los Angeles", "Chicago", "Houston", "Phoenix", "Philadelphia", "San Antonio", "San Diego", "Dallas", "San Jose"],
  "Uruguay": ["Montevideo", "Salto", "Paysandú", "Las Piedras", "Rivera", "Maldonado", "Melo"],
  "Uzbekistan": ["Tashkent", "Samarkand", "Namangan", "Andijan", "Bukhara", "Nukus", "Fergana"],
  "Vanuatu": ["Port Vila", "Luganville", "Norsup", "Port Olry", "Sola"],
  "Vatican City": ["Vatican City"],
  "Venezuela": ["Caracas", "Maracaibo", "Valencia", "Barquisimeto", "Maracay", "Barcelona", "Ciudad Guayana"],
  "Vietnam": ["Ho Chi Minh City", "Hanoi", "Da Nang", "Hai Phong", "Cần Thơ", "Biên Hòa", "Huế"],
  "Yemen": ["Sana'a", "Aden", "Taiz", "Al Hudaydah", "Ibb", "Dhamar", "Mukalla"],
  "Zambia": ["Lusaka", "Ndola", "Kitwe", "Kabwe", "Chingola", "Livingstone", "Luanshya"],
  "Zimbabwe": ["Harare", "Bulawayo", "Chitungwiza", "Mutare", "Epworth", "Gweru", "Kwekwe"]
};

// All Countries in the World
const allCountries = Object.keys(countryCitiesMap).sort();

// Address Format Types
type AddressFieldType = 'state' | 'province' | 'region' | 'county' | 'district' | 'zone' | 'woreda' | 'kebele' | 'postalCode' | 'zipCode' | 'pinCode' | 'postcode' | 'houseNumber' | 'buildingNo' | 'apartment';

interface AddressFieldConfig {
  name: string;
  label: string;
  placeholder: string;
  type: 'text' | 'select';
  options?: string[];
  required?: boolean;
}

interface AddressFormatConfig {
  fields: AddressFieldConfig[];
  regionLabel: string;
  postalLabel: string;
}

// Address formats by country/region
const addressFormats: Record<string, AddressFormatConfig> = {
  // Ethiopia - Special format
  "Ethiopia": {
    fields: [
      { name: "region", label: "Region", placeholder: "Select region", type: "select", options: ["Addis Ababa", "Oromia", "Amhara", "Tigray", "SNNPR", "Somali", "Afar", "Benishangul-Gumuz", "Gambela", "Harari", "Dire Dawa"] },
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
      { name: "state", label: "State", placeholder: "Select state", type: "select", options: ["Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware", "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota", "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming", "District of Columbia"] },
      { name: "county", label: "County", placeholder: "Enter county", type: "text" },
      { name: "zipCode", label: "ZIP Code", placeholder: "Enter ZIP code", type: "text" },
    ],
    regionLabel: "State",
    postalLabel: "ZIP Code"
  },
  // Canada format
  "Canada": {
    fields: [
      { name: "province", label: "Province", placeholder: "Select province", type: "select", options: ["Alberta", "British Columbia", "Manitoba", "New Brunswick", "Newfoundland and Labrador", "Northwest Territories", "Nova Scotia", "Nunavut", "Ontario", "Prince Edward Island", "Quebec", "Saskatchewan", "Yukon"] },
      { name: "postalCode", label: "Postal Code", placeholder: "A1A 1A1", type: "text" },
    ],
    regionLabel: "Province",
    postalLabel: "Postal Code"
  },
  // UK format
  "United Kingdom": {
    fields: [
      { name: "county", label: "County", placeholder: "Enter county", type: "text" },
      { name: "postcode", label: "Postcode", placeholder: "Enter postcode", type: "text" },
    ],
    regionLabel: "County",
    postalLabel: "Postcode"
  },
  // Australia format
  "Australia": {
    fields: [
      { name: "state", label: "State", placeholder: "Select state", type: "select", options: ["New South Wales", "Victoria", "Queensland", "Western Australia", "South Australia", "Tasmania", "Australian Capital Territory", "Northern Territory"] },
      { name: "postcode", label: "Postcode", placeholder: "Enter postcode", type: "text" },
    ],
    regionLabel: "State",
    postalLabel: "Postcode"
  },
  // Germany format
  "Germany": {
    fields: [
      { name: "state", label: "State (Bundesland)", placeholder: "Select state", type: "select", options: ["Baden-Württemberg", "Bavaria", "Berlin", "Brandenburg", "Bremen", "Hamburg", "Hesse", "Lower Saxony", "Mecklenburg-Vorpommern", "North Rhine-Westphalia", "Rhineland-Palatinate", "Saarland", "Saxony", "Saxony-Anhalt", "Schleswig-Holstein", "Thuringia"] },
      { name: "postalCode", label: "Postal Code", placeholder: "Enter postal code", type: "text" },
    ],
    regionLabel: "State",
    postalLabel: "Postal Code"
  },
  // France format
  "France": {
    fields: [
      { name: "region", label: "Region", placeholder: "Select region", type: "select", options: ["Auvergne-Rhône-Alpes", "Bourgogne-Franche-Comté", "Bretagne", "Centre-Val de Loire", "Corse", "Grand Est", "Hauts-de-France", "Île-de-France", "Normandie", "Nouvelle-Aquitaine", "Occitanie", "Pays de la Loire", "Provence-Alpes-Côte d'Azur"] },
      { name: "postalCode", label: "Postal Code", placeholder: "Enter postal code", type: "text" },
    ],
    regionLabel: "Region",
    postalLabel: "Postal Code"
  },
  // Japan format
  "Japan": {
    fields: [
      { name: "prefecture", label: "Prefecture", placeholder: "Select prefecture", type: "select", options: ["Hokkaido", "Aomori", "Iwate", "Miyagi", "Akita", "Yamagata", "Fukushima", "Ibaraki", "Tochigi", "Gunma", "Saitama", "Chiba", "Tokyo", "Kanagawa", "Niigata", "Toyama", "Ishikawa", "Fukui", "Yamanashi", "Nagano", "Gifu", "Shizuoka", "Aichi", "Mie", "Shiga", "Kyoto", "Osaka", "Hyogo", "Nara", "Wakayama", "Tottori", "Shimane", "Okayama", "Hiroshima", "Yamaguchi", "Tokushima", "Kagawa", "Ehime", "Kochi", "Fukuoka", "Saga", "Nagasaki", "Kumamoto", "Oita", "Miyazaki", "Kagoshima", "Okinawa"] },
      { name: "postalCode", label: "Postal Code", placeholder: "Enter postal code", type: "text" },
    ],
    regionLabel: "Prefecture",
    postalLabel: "Postal Code"
  },
  // India format
  "India": {
    fields: [
      { name: "state", label: "State", placeholder: "Select state", type: "select", options: ["Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Delhi"] },
      { name: "district", label: "District", placeholder: "Enter district", type: "text" },
      { name: "pinCode", label: "PIN Code", placeholder: "Enter PIN code", type: "text" },
    ],
    regionLabel: "State",
    postalLabel: "PIN Code"
  },
  // China format
  "China": {
    fields: [
      { name: "province", label: "Province", placeholder: "Select province", type: "select", options: ["Anhui", "Fujian", "Gansu", "Guangdong", "Guizhou", "Hainan", "Hebei", "Heilongjiang", "Henan", "Hubei", "Hunan", "Jiangsu", "Jiangxi", "Jilin", "Liaoning", "Qinghai", "Shaanxi", "Shandong", "Shanxi", "Sichuan", "Yunnan", "Zhejiang", "Guangxi", "Inner Mongolia", "Ningxia", "Xinjiang", "Tibet", "Beijing", "Shanghai", "Tianjin", "Chongqing"] },
      { name: "district", label: "District", placeholder: "Enter district", type: "text" },
      { name: "postalCode", label: "Postal Code", placeholder: "Enter postal code", type: "text" },
    ],
    regionLabel: "Province",
    postalLabel: "Postal Code"
  },
  // Brazil format
  "Brazil": {
    fields: [
      { name: "state", label: "State", placeholder: "Select state", type: "select", options: ["Acre", "Alagoas", "Amapá", "Amazonas", "Bahia", "Ceará", "Distrito Federal", "Espírito Santo", "Goiás", "Maranhão", "Mato Grosso", "Mato Grosso do Sul", "Minas Gerais", "Pará", "Paraíba", "Paraná", "Pernambuco", "Piauí", "Rio de Janeiro", "Rio Grande do Norte", "Rio Grande do Sul", "Rondônia", "Roraima", "Santa Catarina", "São Paulo", "Sergipe", "Tocantins"] },
      { name: "postalCode", label: "CEP", placeholder: "Enter CEP", type: "text" },
    ],
    regionLabel: "State",
    postalLabel: "CEP"
  },
  // Mexico format
  "Mexico": {
    fields: [
      { name: "state", label: "State", placeholder: "Select state", type: "select", options: ["Aguascalientes", "Baja California", "Baja California Sur", "Campeche", "Chiapas", "Chihuahua", "Coahuila", "Colima", "Durango", "Guanajuato", "Guerrero", "Hidalgo", "Jalisco", "Michoacán", "Morelos", "Nayarit", "Nuevo León", "Oaxaca", "Puebla", "Querétaro", "Quintana Roo", "San Luis Potosí", "Sinaloa", "Sonora", "Tabasco", "Tamaulipas", "Tlaxcala", "Veracruz", "Yucatán", "Zacatecas", "Mexico City"] },
      { name: "postalCode", label: "Postal Code", placeholder: "Enter postal code", type: "text" },
    ],
    regionLabel: "State",
    postalLabel: "Postal Code"
  },
  // South Africa format
  "South Africa": {
    fields: [
      { name: "province", label: "Province", placeholder: "Select province", type: "select", options: ["Eastern Cape", "Free State", "Gauteng", "KwaZulu-Natal", "Limpopo", "Mpumalanga", "North West", "Northern Cape", "Western Cape"] },
      { name: "postalCode", label: "Postal Code", placeholder: "Enter postal code", type: "text" },
    ],
    regionLabel: "Province",
    postalLabel: "Postal Code"
  },
  // Nigeria format
  "Nigeria": {
    fields: [
      { name: "state", label: "State", placeholder: "Select state", type: "select", options: ["Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno", "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT", "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara"] },
      { name: "lga", label: "LGA", placeholder: "Enter Local Government Area", type: "text" },
      { name: "postalCode", label: "Postal Code", placeholder: "Enter postal code", type: "text" },
    ],
    regionLabel: "State",
    postalLabel: "Postal Code"
  },
  // Kenya format
  "Kenya": {
    fields: [
      { name: "county", label: "County", placeholder: "Select county", type: "select", options: ["Baringo", "Bomet", "Bungoma", "Busia", "Elgeyo-Marakwet", "Embu", "Garissa", "Homa Bay", "Isiolo", "Kajiado", "Kakamega", "Kericho", "Kiambu", "Kilifi", "Kirinyaga", "Kisii", "Kisumu", "Kitui", "Kwale", "Laikipia", "Lamu", "Machakos", "Makueni", "Mandera", "Marsabit", "Meru", "Migori", "Mombasa", "Murang'a", "Nairobi", "Nakuru", "Nandi", "Narok", "Nyamira", "Nyandarua", "Nyeri", "Samburu", "Siaya", "Taita-Taveta", "Tana River", "Tharaka-Nithi", "Trans Nzoia", "Turkana", "Uasin Gishu", "Vihiga", "Wajir", "West Pokot"] },
      { name: "postalCode", label: "Postal Code", placeholder: "Enter postal code", type: "text" },
    ],
    regionLabel: "County",
    postalLabel: "Postal Code"
  },
  // Saudi Arabia format
  "Saudi Arabia": {
    fields: [
      { name: "region", label: "Region", placeholder: "Select region", type: "select", options: ["Riyadh", "Makkah", "Madinah", "Eastern Province", "Asir", "Tabuk", "Hail", "Northern Borders", "Jizan", "Najran", "Al Bahah", "Al Jawf", "Qassim"] },
      { name: "postalCode", label: "Postal Code", placeholder: "Enter postal code", type: "text" },
    ],
    regionLabel: "Region",
    postalLabel: "Postal Code"
  },
  // UAE format
  "United Arab Emirates": {
    fields: [
      { name: "emirate", label: "Emirate", placeholder: "Select emirate", type: "select", options: ["Abu Dhabi", "Ajman", "Dubai", "Fujairah", "Ras Al Khaimah", "Sharjah", "Umm Al Quwain"] },
      { name: "postalCode", label: "PO Box", placeholder: "Enter PO Box", type: "text" },
    ],
    regionLabel: "Emirate",
    postalLabel: "PO Box"
  },
  // South Korea format
  "South Korea": {
    fields: [
      { name: "province", label: "Province", placeholder: "Select province", type: "select", options: ["Seoul", "Busan", "Daegu", "Incheon", "Gwangju", "Daejeon", "Ulsan", "Sejong", "Gyeonggi", "Gangwon", "North Chungcheong", "South Chungcheong", "North Jeolla", "South Jeolla", "North Gyeongsang", "South Gyeongsang", "Jeju"] },
      { name: "postalCode", label: "Postal Code", placeholder: "Enter postal code", type: "text" },
    ],
    regionLabel: "Province",
    postalLabel: "Postal Code"
  },
  // Russia format
  "Russia": {
    fields: [
      { name: "region", label: "Region", placeholder: "Enter region", type: "text" },
      { name: "postalCode", label: "Postal Code", placeholder: "Enter postal code", type: "text" },
    ],
    regionLabel: "Region",
    postalLabel: "Postal Code"
  },
  // Italy format
  "Italy": {
    fields: [
      { name: "region", label: "Region", placeholder: "Select region", type: "select", options: ["Abruzzo", "Basilicata", "Calabria", "Campania", "Emilia-Romagna", "Friuli-Venezia Giulia", "Lazio", "Liguria", "Lombardy", "Marche", "Molise", "Piedmont", "Apulia", "Sardinia", "Sicily", "Trentino-Alto Adige", "Tuscany", "Umbria", "Aosta Valley", "Veneto"] },
      { name: "province", label: "Province", placeholder: "Enter province", type: "text" },
      { name: "postalCode", label: "CAP", placeholder: "Enter CAP", type: "text" },
    ],
    regionLabel: "Region",
    postalLabel: "CAP"
  },
  // Spain format
  "Spain": {
    fields: [
      { name: "region", label: "Autonomous Community", placeholder: "Select region", type: "select", options: ["Andalusia", "Aragon", "Asturias", "Balearic Islands", "Basque Country", "Canary Islands", "Cantabria", "Castile and León", "Castile-La Mancha", "Catalonia", "Extremadura", "Galicia", "La Rioja", "Madrid", "Murcia", "Navarre", "Valencia", "Ceuta", "Melilla"] },
      { name: "province", label: "Province", placeholder: "Enter province", type: "text" },
      { name: "postalCode", label: "Postal Code", placeholder: "Enter postal code", type: "text" },
    ],
    regionLabel: "Region",
    postalLabel: "Postal Code"
  },
  // Netherlands format
  "Netherlands": {
    fields: [
      { name: "province", label: "Province", placeholder: "Select province", type: "select", options: ["Drenthe", "Flevoland", "Friesland", "Gelderland", "Groningen", "Limburg", "North Brabant", "North Holland", "Overijssel", "South Holland", "Utrecht", "Zeeland"] },
      { name: "postalCode", label: "Postal Code", placeholder: "1234 AB", type: "text" },
    ],
    regionLabel: "Province",
    postalLabel: "Postal Code"
  },
  // Poland format
  "Poland": {
    fields: [
      { name: "voivodeship", label: "Voivodeship", placeholder: "Select voivodeship", type: "select", options: ["Greater Poland", "Kuyavian-Pomeranian", "Lesser Poland", "Łódź", "Lower Silesian", "Lublin", "Lubusz", "Masovian", "Opole", "Podlaskie", "Pomeranian", "Silesian", "Subcarpathian", "Świętokrzyskie", "Warmian-Masurian", "West Pomeranian"] },
      { name: "postalCode", label: "Postal Code", placeholder: "Enter postal code", type: "text" },
    ],
    regionLabel: "Voivodeship",
    postalLabel: "Postal Code"
  },
  // Turkey format
  "Turkey": {
    fields: [
      { name: "province", label: "Province", placeholder: "Enter province", type: "text" },
      { name: "district", label: "District", placeholder: "Enter district", type: "text" },
      { name: "postalCode", label: "Postal Code", placeholder: "Enter postal code", type: "text" },
    ],
    regionLabel: "Province",
    postalLabel: "Postal Code"
  },
  // Egypt format
  "Egypt": {
    fields: [
      { name: "governorate", label: "Governorate", placeholder: "Select governorate", type: "select", options: ["Alexandria", "Aswan", "Asyut", "Beheira", "Beni Suef", "Cairo", "Dakahlia", "Damietta", "Faiyum", "Gharbia", "Giza", "Ismailia", "Kafr El Sheikh", "Luxor", "Matrouh", "Minya", "Monufia", "New Valley", "North Sinai", "Port Said", "Qalyubia", "Qena", "Red Sea", "Sharqia", "Sohag", "South Sinai", "Suez"] },
      { name: "postalCode", label: "Postal Code", placeholder: "Enter postal code", type: "text" },
    ],
    regionLabel: "Governorate",
    postalLabel: "Postal Code"
  },
};

// Default address format for countries not specifically defined
const defaultAddressFormat: AddressFormatConfig = {
  fields: [
    { name: "region", label: "Region/State", placeholder: "Enter region or state", type: "text" },
    { name: "postalCode", label: "Postal Code", placeholder: "Enter postal code", type: "text" },
  ],
  regionLabel: "Region",
  postalLabel: "Postal Code"
};

// Function to get address format for a country
const getAddressFormat = (country: string): AddressFormatConfig => {
  return addressFormats[country] || defaultAddressFormat;
};

// Common Allergies
const commonAllergies = [
  "Penicillin", "Sulfa drugs", "Aspirin", "Ibuprofen", "Codeine",
  "Latex", "Peanuts", "Shellfish", "Eggs", "Milk",
  "Contrast Dye", "Iodine", "None Known", "Other"
];

// Common Chronic Conditions
const commonChronicConditions = [
  "Hypertension", "Type 2 Diabetes Mellitus", "Type 1 Diabetes Mellitus",
  "Asthma", "COPD", "Hypothyroidism", "Hyperthyroidism",
  "Rheumatoid Arthritis", "Chronic Kidney Disease", "Heart Failure",
  "Atrial Fibrillation", "Epilepsy", "HIV/AIDS", "Tuberculosis",
  "None", "Other"
];

export function PatientManagement({ onNavigate }: PatientManagementProps) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedAllergies, setSelectedAllergies] = useState<string[]>([]);
  const [selectedConditions, setSelectedConditions] = useState<string[]>([]);
  const [otherAllergy, setOtherAllergy] = useState("");
  const [otherCondition, setOtherCondition] = useState("");
  const { toast } = useToast();

  const [newPatient, setNewPatient] = useState({
    // Personal Information
    title: "",
    firstName: "",
    middleName: "",
    lastName: "",
    dateOfBirth: "",
    gender: "",
    maritalStatus: "",
    nationality: "",
    religion: "",
    occupation: "",
    // Identification
    idType: "national_id",
    idNumber: "",
    // Contact Information
    phone: "",
    alternatePhone: "",
    email: "",
    preferredLanguage: "",
    // Address Information - Base
    country: "",
    address: "",
    city: "",
    // Address Information - Dynamic fields for different country formats
    region: "",
    zone: "",
    woreda: "",
    kebele: "",
    houseNumber: "",
    state: "",
    county: "",
    zipCode: "",
    province: "",
    postalCode: "",
    postcode: "",
    district: "",
    pinCode: "",
    prefecture: "",
    emirate: "",
    lga: "",
    governorate: "",
    voivodeship: "",
    // Medical Information
    bloodType: "",
    rhFactor: "",
    organDonor: "",
    allergies: "",
    chronicConditions: "",
    // Emergency Contact 1
    emergencyContactName: "",
    emergencyContactRelationship: "",
    emergencyContactPhone: "",
    emergencyContactAddress: "",
    // Emergency Contact 2
    emergencyContact2Name: "",
    emergencyContact2Relationship: "",
    emergencyContact2Phone: "",
    // Insurance Information
    insuranceProvider: "",
    insuranceId: "",
    insuranceGroup: "",
    // Guardian Information
    guardianName: "",
    guardianRelation: "",
    guardianPhone: "",
  });

  const fetchPatients = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/patients?search=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();
      if (data.success) {
        setPatients(data.data.patients);
      }
    } catch (error) {
      console.error("Failed to fetch patients:", error);
      toast({
        title: "Error",
        description: "Failed to load patients",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, toast]);

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  const handleCreatePatient = async () => {
    try {
      setIsSaving(true);
      const response = await fetch("/api/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newPatient,
          allergies: newPatient.allergies.split(",").map((a) => a.trim()).filter(Boolean),
          chronicConditions: newPatient.chronicConditions.split(",").map((c) => c.trim()).filter(Boolean),
        }),
      });

      const data = await response.json();
      if (data.success) {
        toast({
          title: "Success",
          description: "Patient created successfully",
        });
        setIsAddDialogOpen(false);
        setNewPatient({
          title: "",
          firstName: "",
          middleName: "",
          lastName: "",
          dateOfBirth: "",
          gender: "",
          maritalStatus: "",
          nationality: "",
          religion: "",
          occupation: "",
          nationalId: "",
          passportNumber: "",
          phone: "",
          alternatePhone: "",
          email: "",
          preferredLanguage: "",
          country: "",
          address: "",
          city: "",
          region: "",
          zone: "",
          woreda: "",
          kebele: "",
          houseNumber: "",
          state: "",
          county: "",
          zipCode: "",
          province: "",
          postalCode: "",
          postcode: "",
          district: "",
          pinCode: "",
          prefecture: "",
          emirate: "",
          lga: "",
          governorate: "",
          voivodeship: "",
          bloodType: "",
          rhFactor: "",
          organDonor: "",
          allergies: "",
          chronicConditions: "",
          emergencyContactName: "",
          emergencyContactRelationship: "",
          emergencyContactPhone: "",
          emergencyContactAddress: "",
          emergencyContact2Name: "",
          emergencyContact2Relationship: "",
          emergencyContact2Phone: "",
          insuranceProvider: "",
          insuranceId: "",
          insuranceGroup: "",
          guardianName: "",
          guardianRelation: "",
          guardianPhone: "",
        });
        setSelectedAllergies([]);
        setSelectedConditions([]);
        setOtherAllergy("");
        setOtherCondition("");
        fetchPatients();
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create patient",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const calculateAge = (dob: string) => {
    if (!dob) return null;
    const today = new Date();
    const birthDate = new Date(dob);
    
    // Check if date is valid and not in the future
    if (isNaN(birthDate.getTime()) || birthDate > today) return null;
    
    let years = today.getFullYear() - birthDate.getFullYear();
    let months = today.getMonth() - birthDate.getMonth();
    let days = today.getDate() - birthDate.getDate();
    
    if (days < 0) {
      months--;
      const prevMonth = new Date(today.getFullYear(), today.getMonth(), 0);
      days += prevMonth.getDate();
    }
    
    if (months < 0) {
      years--;
      months += 12;
    }
    
    // For infants under 1 year, show months and days
    if (years === 0) {
      if (months === 0) {
        return `${days} day${days !== 1 ? 's' : ''} old`;
      }
      return `${months} month${months !== 1 ? 's' : ''} ${days} day${days !== 1 ? 's' : ''} old`;
    }
    
    // For children under 3, show years and months
    if (years < 3 && months > 0) {
      return `${years} year${years !== 1 ? 's' : ''} ${months} month${months !== 1 ? 's' : ''} old`;
    }
    
    return `${years} year${years !== 1 ? 's' : ''} old`;
  };

  // Calculate age for display
  const displayAge = calculateAge(newPatient.dateOfBirth);

  const parseJsonArray = (jsonStr?: string): string[] => {
    if (!jsonStr) return [];
    try {
      return JSON.parse(jsonStr);
    } catch {
      return [];
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Patient Management</h2>
          <p className="text-slate-500">Manage patient records synced with Bahmni HIS</p>
        </div>
        <div className="flex gap-2">
          <Button 
            className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600"
            onClick={() => setIsAddDialogOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            New Patient
          </Button>
        </div>
      </div>
      
      {/* Patient Registration Card Modal */}
      <PatientRegistrationCard
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onSubmit={async (formData) => {
          try {
            setIsSaving(true);
            const response = await fetch("/api/patients", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                title: formData.title,
                firstName: formData.firstName,
                middleName: formData.middleName,
                lastName: formData.lastName,
                dateOfBirth: formData.dateOfBirth,
                gender: formData.gender,
                maritalStatus: formData.maritalStatus,
                nationality: formData.nationalities.join(", "),
                religion: formData.religion,
                nationalIdType: formData.idType,
                nationalHealthId: formData.idNumber,
                phone: formData.phone,
                alternatePhone: formData.alternatePhone,
                email: formData.email,
                country: formData.address.country,
                city: formData.address.city,
                address: formData.address.streetAddress,
                region: formData.address.region || "",
                zone: formData.address.zone || "",
                woreda: formData.address.woreda || "",
                kebele: formData.address.kebele || "",
                state: formData.address.state || "",
                county: formData.address.county || "",
                zipCode: formData.address.zipCode || "",
                province: formData.address.province || "",
                postalCode: formData.address.postalCode || "",
                postcode: formData.address.postcode || "",
                bloodType: formData.bloodType,
                rhFactor: formData.rhFactor,
                allergies: formData.allergies,
                chronicConditions: formData.chronicConditions,
                organDonor: formData.organDonor,
                emergencyContactName: formData.emergencyContacts[0]?.name || "",
                emergencyContactRelationship: formData.emergencyContacts[0]?.relationship || "",
                emergencyContactPhone: formData.emergencyContacts[0]?.phone || "",
                emergencyContactEmail: formData.emergencyContacts[0]?.email || "",
                emergencyContact2Name: formData.emergencyContacts[1]?.name || "",
                emergencyContact2Relationship: formData.emergencyContacts[1]?.relationship || "",
                emergencyContact2Phone: formData.emergencyContacts[1]?.phone || "",
                notes: formData.notes,
                insuranceProvider: formData.insuranceProvider,
                insuranceId: formData.insuranceId,
                insuranceGroup: formData.insuranceGroup,
              }),
            });

            const data = await response.json();
            if (data.success) {
              toast({
                title: "Success",
                description: "Patient registered successfully",
              });
              fetchPatients();
            } else {
              throw new Error(data.error);
            }
          } catch (error) {
            toast({
              title: "Error",
              description: "Failed to register patient",
              variant: "destructive",
            });
          } finally {
            setIsSaving(false);
          }
        }}
        mode="create"
      />

      {/* Search and Filters */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by name or MRN..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline">
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Patient List */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Patient Cards */}
        <div className="lg:col-span-2">
          <Card className="border-0 shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Patient List</CardTitle>
              <CardDescription>
                {isLoading ? "Loading..." : `${patients.length} patients found`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px] pr-4">
                {isLoading ? (
                  <div className="flex items-center justify-center h-[400px]">
                    <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
                  </div>
                ) : patients.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-[400px] text-center">
                    <User className="h-12 w-12 text-slate-300 mb-4" />
                    <h3 className="font-medium text-slate-600">No Patients Found</h3>
                    <p className="text-sm text-slate-400">Add your first patient to get started</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {patients.map((patient) => {
                      const allergies = parseJsonArray(patient.allergies);
                      return (
                        <motion.div
                          key={patient.id}
                          whileHover={{ scale: 1.01 }}
                          className={`p-4 rounded-lg border cursor-pointer transition-all ${
                            selectedPatient?.id === patient.id
                              ? "border-emerald-500 bg-emerald-50"
                              : "border-slate-200 bg-white hover:border-slate-300"
                          }`}
                          onClick={() => setSelectedPatient(patient)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-10 w-10">
                                <AvatarFallback className="bg-emerald-100 text-emerald-700">
                                  {patient.firstName[0]}{patient.lastName[0]}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <h4 className="font-medium text-slate-800">
                                  {patient.firstName} {patient.lastName}
                                </h4>
                                <p className="text-sm text-slate-500">{patient.mrn}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {allergies.length > 0 && (
                                <Badge variant="outline" className="bg-red-50 border-red-200 text-red-700">
                                  <AlertCircle className="h-3 w-3 mr-1" />
                                  {allergies.length} Allergies
                                </Badge>
                              )}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem>
                                    <Eye className="h-4 w-4 mr-2" />
                                    View Details
                                  </DropdownMenuItem>
                                  <DropdownMenuItem>
                                    <Stethoscope className="h-4 w-4 mr-2" />
                                    New Consultation
                                  </DropdownMenuItem>
                                  <DropdownMenuItem>
                                    <FileText className="h-4 w-4 mr-2" />
                                    Documents
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem>
                                    <Edit className="h-4 w-4 mr-2" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem className="text-red-600">
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Patient Details */}
        <div className="lg:col-span-1">
          {selectedPatient ? (
            <Card className="border-0 shadow-md">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Avatar className="h-14 w-14">
                    <AvatarFallback className="bg-emerald-100 text-emerald-700 text-lg">
                      {selectedPatient.firstName[0]}{selectedPatient.lastName[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle>{selectedPatient.firstName} {selectedPatient.lastName}</CardTitle>
                    <CardDescription>{selectedPatient.mrn}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="overview">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="medical">Medical</TabsTrigger>
                    <TabsTrigger value="contact">Contact</TabsTrigger>
                  </TabsList>
                  <TabsContent value="overview" className="space-y-4 mt-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-slate-50 rounded-lg">
                        <p className="text-xs text-slate-500">Age</p>
                        <p className="font-semibold">{calculateAge(selectedPatient.dateOfBirth)}</p>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-lg">
                        <p className="text-xs text-slate-500">Gender</p>
                        <p className="font-semibold capitalize">{selectedPatient.gender}</p>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-lg">
                        <p className="text-xs text-slate-500">Blood Type</p>
                        <p className="font-semibold">{selectedPatient.bloodType || "Unknown"}</p>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-lg">
                        <p className="text-xs text-slate-500">MRN</p>
                        <p className="font-semibold text-sm">{selectedPatient.mrn}</p>
                      </div>
                    </div>
                    <Separator />
                    <div>
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <Activity className="h-4 w-4 text-emerald-500" />
                        Quick Actions
                      </h4>
                      <div className="grid grid-cols-2 gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => onNavigate?.('consultations', selectedPatient.id)}
                        >
                          <Stethoscope className="h-4 w-4 mr-2" />
                          Consult
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => onNavigate?.('documentation', selectedPatient.id)}
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          Records
                        </Button>
                      </div>
                    </div>
                    {selectedPatient.consultations && selectedPatient.consultations.length > 0 && (
                      <>
                        <Separator />
                        <div>
                          <h4 className="font-medium mb-2">Recent Visits</h4>
                          <div className="space-y-2">
                            {selectedPatient.consultations.slice(0, 3).map((consultation) => (
                              <div key={consultation.id} className="p-2 bg-slate-50 rounded-lg text-sm">
                                <p className="font-medium">{consultation.chiefComplaint || "Consultation"}</p>
                                <p className="text-xs text-slate-500">
                                  {new Date(consultation.consultationDate).toLocaleDateString()}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </TabsContent>
                  <TabsContent value="medical" className="space-y-4 mt-4">
                    <div>
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-red-500" />
                        Allergies
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {parseJsonArray(selectedPatient.allergies).length > 0 ? (
                          parseJsonArray(selectedPatient.allergies).map((allergy, i) => (
                            <Badge key={i} variant="outline" className="bg-red-50 border-red-200 text-red-700">
                              {allergy}
                            </Badge>
                          ))
                        ) : (
                          <p className="text-sm text-slate-500">No known allergies</p>
                        )}
                      </div>
                    </div>
                    <Separator />
                    <div>
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <Heart className="h-4 w-4 text-pink-500" />
                        Chronic Conditions
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {parseJsonArray(selectedPatient.chronicConditions).length > 0 ? (
                          parseJsonArray(selectedPatient.chronicConditions).map((condition, i) => (
                            <Badge key={i} variant="outline" className="bg-pink-50 border-pink-200 text-pink-700">
                              {condition}
                            </Badge>
                          ))
                        ) : (
                          <p className="text-sm text-slate-500">No chronic conditions</p>
                        )}
                      </div>
                    </div>
                    {selectedPatient.medications && selectedPatient.medications.length > 0 && (
                      <>
                        <Separator />
                        <div>
                          <h4 className="font-medium mb-2">Active Medications</h4>
                          <div className="space-y-2">
                            {selectedPatient.medications.filter(m => m.status === 'active').map((med) => (
                              <div key={med.id} className="p-2 bg-slate-50 rounded-lg text-sm">
                                <p className="font-medium">{med.medicationName}</p>
                                {med.dosage && <p className="text-xs text-slate-500">{med.dosage}</p>}
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </TabsContent>
                  <TabsContent value="contact" className="space-y-4 mt-4">
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                        <Phone className="h-4 w-4 text-slate-400" />
                        <div>
                          <p className="text-xs text-slate-500">Phone</p>
                          <p className="font-medium">{selectedPatient.phone || "Not provided"}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                        <Mail className="h-4 w-4 text-slate-400" />
                        <div>
                          <p className="text-xs text-slate-500">Email</p>
                          <p className="font-medium">{selectedPatient.email || "Not provided"}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                        <Calendar className="h-4 w-4 text-slate-400" />
                        <div>
                          <p className="text-xs text-slate-500">Date of Birth</p>
                          <p className="font-medium">
                            {new Date(selectedPatient.dateOfBirth).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      {selectedPatient.address && (
                        <div className="p-3 bg-slate-50 rounded-lg">
                          <p className="text-xs text-slate-500 mb-1">Address</p>
                          <p className="font-medium text-sm">{selectedPatient.address}</p>
                          {selectedPatient.city && (
                            <p className="text-sm text-slate-600">{selectedPatient.city}</p>
                          )}
                        </div>
                      )}
                      {/* Emergency Contact in Patient Details */}
                      {(selectedPatient.emergencyContactName || selectedPatient.emergencyContactPhone) && (
                        <div className="mt-2 pt-3 border-t border-slate-200">
                          <div className="flex items-center gap-2 mb-2">
                            <AlertCircle className="h-4 w-4 text-amber-500" />
                            <p className="text-xs font-medium text-slate-600">Emergency Contact</p>
                          </div>
                          <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                            <p className="font-medium text-sm text-slate-800">{selectedPatient.emergencyContactName}</p>
                            {selectedPatient.emergencyContactRelation && (
                              <p className="text-xs text-slate-500 capitalize">{selectedPatient.emergencyContactRelation.replace('_', ' ')}</p>
                            )}
                            {selectedPatient.emergencyContactPhone && (
                              <div className="flex items-center gap-2 mt-1">
                                <Phone className="h-3 w-3 text-slate-400" />
                                <p className="text-sm text-slate-700">{selectedPatient.emergencyContactPhone}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-0 shadow-md">
              <CardContent className="flex flex-col items-center justify-center h-[400px] text-center">
                <User className="h-12 w-12 text-slate-300 mb-4" />
                <h3 className="font-medium text-slate-600">No Patient Selected</h3>
                <p className="text-sm text-slate-400">Select a patient to view details</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
