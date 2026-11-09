import type { Gender } from "@/types";
import { EXTRA_NAMES, NATIONAL_NAMES } from "./nationalNames";

export interface NameCulture {
  male: string[];
  female: string[];
  surnames: string[];
  /** Family name is written first (e.g. "Zhang Weiming") */
  familyFirst?: boolean;
  femaleSurname?: (surname: string) => string;
}

const w = (s: string) => s.trim().split(/\s+/);

const eastSlavicFemale = (s: string) =>
  s.endsWith("ov") || s.endsWith("ev")
    ? `${s}a`
    : s.endsWith("in")
      ? `${s}a`
      : s.endsWith("sky")
        ? `${s.slice(0, -1)}aya`
        : s;
const westSlavicFemale = (s: string) =>
  s.endsWith("ski")
    ? `${s.slice(0, -1)}a`
    : s.endsWith("cki")
      ? `${s.slice(0, -1)}a`
      : s.endsWith("y")
        ? `${s.slice(0, -1)}a`
        : s;

export const CULTURES: Record<string, NameCulture> = {
  anglo: {
    male: w("James Oliver William Henry Thomas Daniel Samuel Edward Jack Ryan"),
    female: w(
      "Emma Charlotte Grace Hannah Olivia Megan Chloe Lucy Sarah Eleanor",
    ),
    surnames: w(
      "Smith Taylor Brown Wilson Evans Walker Hughes Thompson Clarke Bennett Foster Mitchell Reid Harper",
    ),
  },
  hispanic: {
    male: w(
      "Mateo Santiago Diego Javier Alejandro Carlos Andres Luis Pablo Rafael",
    ),
    female: w(
      "Sofia Valentina Camila Lucia Isabella Elena Carmen Daniela Paula Marta",
    ),
    surnames: w(
      "Garcia Rodriguez Fernandez Lopez Martinez Sanchez Romero Navarro Torres Vargas Castillo Herrera Molina Ortega",
    ),
  },
  lusophone: {
    male: w("Joao Pedro Tiago Gabriel Bruno Lucas Miguel Andre Felipe Rui"),
    female: w(
      "Ana Beatriz Mariana Larissa Camila Ines Juliana Carolina Leticia Marta",
    ),
    surnames: w(
      "Silva Santos Oliveira Costa Pereira Almeida Carvalho Ribeiro Moreira Barbosa Teixeira Cardoso",
    ),
  },
  francophone: {
    male: w(
      "Louis Hugo Mathieu Antoine Julien Nicolas Etienne Baptiste Maxime Romain",
    ),
    female: w(
      "Camille Manon Chloe Lea Margaux Pauline Claire Juliette Amelie Elodie",
    ),
    surnames: w(
      "Martin Bernard Dubois Moreau Laurent Lefevre Roux Fournier Girard Bonnet Mercier Vidal",
    ),
  },
  germanic: {
    male: w(
      "Lukas Felix Jonas Maximilian Tobias Florian Matthias Stefan Jan Lars",
    ),
    female: w(
      "Anna Lena Marie Katharina Julia Sophie Laura Hannah Greta Johanna",
    ),
    surnames: w(
      "Muller Schmidt Fischer Weber Wagner Becker Hoffmann Schulz Koch Richter Neumann Kruger Brandt Vogel",
    ),
  },
  italian: {
    male: w(
      "Marco Luca Matteo Alessandro Giovanni Lorenzo Francesco Davide Stefano Paolo",
    ),
    female: w(
      "Giulia Chiara Francesca Sara Alessia Elisa Valentina Martina Silvia Federica",
    ),
    surnames: w(
      "Rossi Ferrari Bianchi Romano Colombo Ricci Marino Greco Conti Gallo Fontana Moretti",
    ),
  },
  dutch: {
    male: w("Daan Sven Bram Thijs Joost Ruben Pieter Gijs Jeroen Stijn"),
    female: w("Sanne Fleur Lotte Anouk Eva Femke Noor Marit Lieke Iris"),
    surnames: w(
      "Dijkstra Bakker Visser Smit Meijer Mulder Bosman Vermeulen Hendriks Kuiper Peeters Willems",
    ),
  },
  nordic: {
    male: w("Erik Anders Henrik Lars Nils Sigurd Olav Bjorn Mikael Emil"),
    female: w("Ingrid Astrid Freya Sigrid Maja Linnea Sofie Karin Thea Elin"),
    surnames: w(
      "Hansen Johansson Andersen Haugen Nilsen Lindqvist Eriksson Berg Dahl Solberg Nygaard Holm Strand Bakken",
    ),
  },
  eastslavic: {
    male: w(
      "Ivan Alexei Dmitri Sergei Nikolai Andrei Pavel Mikhail Viktor Oleg Maxim Yuri",
    ),
    female: w(
      "Anna Elena Olga Natalia Irina Tatiana Svetlana Katerina Marina Daria Oksana Vera",
    ),
    surnames: w(
      "Ivanov Petrov Smirnov Volkov Sokolov Kuznetsov Morozov Popov Lebedev Kovalenko Shevchenko Bondarenko Melnik Karpenko Zaitsev Orlov Tkachenko",
    ),
    femaleSurname: eastSlavicFemale,
  },
  westslavic: {
    male: w("Jakub Tomasz Marek Piotr Krzysztof Michal Pavel Lukas Jan Adam"),
    female: w(
      "Katarzyna Magdalena Agnieszka Marta Zuzana Eva Petra Monika Anna Ivana",
    ),
    surnames: w(
      "Kowalski Nowak Wisniewski Dvorak Novotny Svoboda Kaminski Zielinski Cerny Prochazka Wojcik Mazur Krawczyk Nemec",
    ),
    femaleSurname: westSlavicFemale,
  },
  southslavic: {
    male: w("Nikola Marko Stefan Luka Ivan Milos Dragan Goran Bojan Darko"),
    female: w(
      "Jelena Milica Ana Maja Ivana Marija Tijana Sanja Katarina Dragana",
    ),
    surnames: w(
      "Jovanovic Petrovic Nikolic Markovic Kovacevic Babic Horvat Kovac Novak Popovic Stankovic Ilic Radic Vukovic",
    ),
  },
  hungarian: {
    male: w(
      "Laszlo Gabor Zoltan Balazs Peter Istvan Tamas Attila Gergely Akos",
    ),
    female: w("Eszter Katalin Zsofia Reka Anna Orsolya Dora Judit Agnes Kinga"),
    surnames: w(
      "Nagy Kovacs Toth Szabo Horvath Varga Kiss Molnar Nemeth Farkas Balogh Papp Takacs Lukacs",
    ),
    familyFirst: true,
  },
  romanian: {
    male: w(
      "Andrei Mihai Alexandru Razvan Cristian Radu Florin Bogdan Dan Vlad",
    ),
    female: w(
      "Maria Elena Ioana Andreea Cristina Ana Raluca Daniela Simona Oana",
    ),
    surnames: w(
      "Popescu Ionescu Dumitru Stan Constantin Marin Georgescu Radu Dinu Stoica Munteanu Barbu Lupu Ciobanu",
    ),
  },
  greek: {
    male: w(
      "Nikos Giorgos Dimitris Kostas Yannis Panagiotis Christos Stavros Thanos Alexandros",
    ),
    female: w(
      "Maria Eleni Katerina Sofia Georgia Ioanna Despina Vasiliki Anna Christina",
    ),
    surnames: w(
      "Papadopoulos Georgiou Nikolaou Karagiannis Vasileiou Alexiou Papas Dimitriou Antoniou Stavrou Makris Kostas",
    ),
  },
  turkic: {
    male: w("Emre Mehmet Murat Ahmet Burak Kerem Timur Rustam Farid Eldar"),
    female: w(
      "Elif Zeynep Ayse Selin Aigerim Dilnoza Leyla Gulnara Nargiz Aysel",
    ),
    surnames: w(
      "Yilmaz Kaya Demir Celik Sahin Aydin Mammadov Aliyev Karimov Nazarov Rakhimov Abdullayev Karimli Tursunov",
    ),
  },
  arabic: {
    male: w("Omar Youssef Karim Hassan Tariq Mahmoud Ali Khalid Ibrahim Samir"),
    female: w("Layla Nour Amira Yasmin Salma Fatima Dina Hana Rania Mariam"),
    surnames: w(
      "Haddad Nasser Mansour Khalil Farouk Saleh Rahman Jabari Said Aziz Darwish Hamdan Suleiman Abbas",
    ),
  },
  persian: {
    male: w("Alireza Amir Mohammad Hossein Reza Mehdi Farhad Arash Navid Kian"),
    female: w("Sara Maryam Fatemeh Neda Shirin Parisa Mina Ladan Roya Azadeh"),
    surnames: w(
      "Tabatabaei Ghaem Moradi Hosseini Rezaei Ahmadi Karimi Jafari Mousavi Sadeghi Kazemi Rostami Naderi Bahrami",
    ),
  },
  indian: {
    male: w(
      "Arjun Rohan Karthik Vikram Siddharth Aditya Rahul Nikhil Suresh Pranav Harish Manoj",
    ),
    female: w(
      "Priya Ananya Divya Kavya Meera Sneha Lakshmi Pooja Aarti Nandini Shruti Ishita",
    ),
    surnames: w(
      "Sharma Patel Reddy Iyer Nair Gupta Singh Mehta Krishnan Subramanian Chatterjee Banerjee Desai Kulkarni Menon Verma Rao Pillai",
    ),
  },
  chinese: {
    male: w(
      "Weiming Jianhua Haoran Zhiqiang Junjie Boyuan Lei Xiaolong Yuchen Tianyu",
    ),
    female: w(
      "Meiling Xiaoyan Yifei Jingwen Lanying Shuhua Ruoxi Qianqian Haiyan Yuting",
    ),
    surnames: w("Zhang Wang Li Liu Chen Yang Zhao Huang Zhou Wu Xu Sun Ma Zhu"),
    familyFirst: true,
  },
  japanese: {
    male: w("Haruto Kenji Takumi Sora Daiki Ryota Hiroshi Yuto Kaito Shun"),
    female: w("Yui Hina Sakura Aoi Mio Rin Emi Haruka Misaki Nanami"),
    surnames: w(
      "Sato Suzuki Takahashi Tanaka Watanabe Ito Yamamoto Hayashi Kobayashi Kato Yoshida Matsumoto",
    ),
    familyFirst: true,
  },
  korean: {
    male: w(
      "Minjun Seojun Jihoon Hyunwoo Dongwoo Taeyang Joonho Sungmin Yejun Jiwon",
    ),
    female: w(
      "Seoyeon Jiwoo Minseo Haeun Yuna Soyeon Chaewon Hyejin Nayeon Suji",
    ),
    surnames: w("Kim Lee Park Choi Jung Kang Cho Yoon Jang Lim Han Shin"),
    familyFirst: true,
  },
  vietnamese: {
    male: w("Minh Quang Hieu Dung Tuan Long Khoa Phuc Bao Nam"),
    female: w("Linh Mai Lan Huong Thao Ngoc Trang Hanh Phuong Yen"),
    surnames: w("Nguyen Tran Le Pham Hoang Phan Vu Dang Bui Do Ngo Duong"),
    familyFirst: true,
  },
  malay: {
    male: w("Budi Agus Rizky Fajar Dimas Arif Hadi Wira Eko Bayu"),
    female: w("Siti Dewi Putri Ayu Nurul Intan Sari Wulan Rani Melati"),
    surnames: w(
      "Santoso Wijaya Pratama Hidayat Saputra Nugroho Kusuma Rahman Lim Tan Cruz Reyes Bautista Aquino",
    ),
  },
  caucasus: {
    male: w("Giorgi Levan Davit Tigran Aram Armen Vahe Nika Gor Hayk"),
    female: w("Nino Mariam Tamar Ani Anahit Lilit Nare Eka Mane Salome"),
    surnames: w(
      "Beridze Kapanadze Gelashvili Sargsyan Grigoryan Hakobyan Harutyunyan Avetisyan Mkrtchyan Khachatryan Lomidze Kiknadze Mchedlishvili Gogoladze",
    ),
  },
  hebrew: {
    male: w("Eitan Noam Yonatan Avi Itai Omri Gal Ron Dor Lior"),
    female: w("Noa Maya Tamar Shira Yael Michal Talia Liat Roni Adi"),
    surnames: w(
      "Cohen Levi Mizrahi Peretz Biton Katz Friedman Shapiro Azulay Dahan Goldberg Ben-David",
    ),
  },
  african: {
    male: w(
      "Chinedu Kwame Tendai Sipho Kofi Emeka Tunde Baraka Mamadou Ousmane",
    ),
    female: w(
      "Amara Ngozi Zanele Abena Fatou Chioma Wanjiru Aisha Thandiwe Folake",
    ),
    surnames: w(
      "Okafor Mensah Dlamini Nkosi Adeyemi Diallo Mwangi Ndlovu Okonkwo Traore Banda Kamara Osei Balogun",
    ),
  },
  baltic: {
    male: w("Jonas Matis Aivars Tomas Janis Mikko Juha Rasmus Tonis Karlis"),
    female: w("Liga Inga Laura Katrin Aino Marika Egle Ruta Kadri Milda"),
    surnames: w(
      "Kalnins Ozols Petrauskas Kazlauskas Tamm Saar Virtanen Korhonen Makinen Laine Jarvinen Magi",
    ),
  },
};

const CULTURE_COUNTRIES: Record<string, string> = {
  anglo: "US GB GB-ENG GB-SCO GB-WLS IE CA AU NZ JM TT",
  hispanic: "ES MX AR CO PE CL VE EC UY PY BO CU DO GT HN SV NI CR PA PR",
  lusophone: "PT BR AO MZ CV",
  francophone: "FR BE LU MC HT",
  germanic: "DE AT CH LI",
  italian: "IT SM MT",
  dutch: "NL",
  nordic: "NO SE DK IS FO",
  eastslavic: "RU BY UA",
  westslavic: "PL CZ SK",
  southslavic: "RS HR BA SI ME MK BG AL XK",
  hungarian: "HU",
  romanian: "RO MD",
  greek: "GR CY",
  turkic: "TR AZ UZ KZ KG TM TJ",
  arabic: "SA AE EG MA DZ TN LY IQ SY JO LB KW QA BH OM YE PS SD",
  persian: "IR AF",
  indian: "IN PK BD NP LK",
  chinese: "CN TW HK MO SG",
  japanese: "JP",
  korean: "KR KP",
  vietnamese: "VN",
  malay: "ID MY PH TH",
  caucasus: "AM GE",
  hebrew: "IL",
  baltic: "LT LV EE FI",
};

const CULTURE_BY_COUNTRY = new Map<string, string>(
  Object.entries(CULTURE_COUNTRIES).flatMap(([culture, codes]) =>
    codes.split(" ").map((c) => [c, culture] as const),
  ),
);

const CONTINENT_DEFAULT: Record<string, string> = {
  Africa: "african",
  Asia: "indian",
  Europe: "germanic",
  "North America": "hispanic",
  "South America": "hispanic",
  Oceania: "anglo",
  Antarctica: "anglo",
};

export function cultureFor(
  countryCode: string,
  continent: string,
): NameCulture {
  if (NATIONAL_NAMES[countryCode]) return NATIONAL_NAMES[countryCode];
  const id =
    CULTURE_BY_COUNTRY.get(countryCode) ??
    CONTINENT_DEFAULT[continent] ??
    "anglo";
  return CULTURES[id];
}

for (const [id, extra] of Object.entries(EXTRA_NAMES)) {
  for (const field of ["male", "female", "surnames"] as const) {
    CULTURES[id][field] = [
      ...new Set([...CULTURES[id][field], ...(extra[field] ?? [])]),
    ];
  }
}

export function formatCultureName(
  culture: NameCulture,
  given: string,
  surname: string,
  gender: Gender,
): string {
  const family =
    gender === "female" && culture.femaleSurname
      ? culture.femaleSurname(surname)
      : surname;
  return culture.familyFirst ? `${family} ${given}` : `${given} ${family}`;
}
