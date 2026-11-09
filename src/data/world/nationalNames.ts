import type { NameCulture } from "./cultures";

// Curated fictional-character name pools. A nationality is a default naming tradition,
// not a claim that everyone in a country has the same ancestry or language.
const words = (s: string) => s.split(" ");
const pool = (
  male: string,
  female: string,
  surnames: string,
  familyFirst = false,
): NameCulture => ({
  male: words(male),
  female: words(female),
  surnames: words(surnames),
  familyFirst,
});
export const NATIONAL_NAMES: Record<string, NameCulture> = {
  MN: pool(
    "Altan Amar Amgalan Anar Anand Batbayar Batbold Batdorj Baterdene Batsaikhan Bayar Bayarsaikhan Bilguun Chinguun Davaadorj Enkhbayar Enkhbold Enkhjin Ganbat Ganbold Ganbaatar Munkhbayar Munkhbat Munkhbold Naran Ochir Temuulen Tseren Tumur Uuganbayar",
    "Ariunaa Ariunbold Bolor Bolormaa Buyankhishig Delgermaa Dolgor Enkhmaa Enkhjin Khaliun Khishigjargal Munkhzul Nomin Odonchimeg Oyungerel Oyuntsetseg Sarangerel Sarantuya Solongo Suvd Tsetseg Tsolmon Tuul Uranchimeg",
    "Amar Bat Batbayar Batbold Batdorj Baterdene Bold Davaa Davaadorj Dorj Enkh Enkhbat Enkhbold Ganbaatar Gantumur Munkh Munkhbat Namsrai Ochir Purev Sainbayar Sukhbaatar Tseren Tumur Zorig",
    true,
  ),
  KH: pool(
    "Bora Borin Bunthoeun Chan Chann Chhay Dara Daravuth Kosal Makara Narong Phalla Piseth Rith Rithy Sambath Samnang Saran Sareth Serey Sokha Sophal Sophat Sothea Sovann Vannak Veasna Vichea Vichet Virak",
    "Bopha Chenda Chivy Kalyan Kanya Kunthea Leakena Malis Nary Neary Phalla Pisey Ratana Rachana Serey Sokea Sokunthea Sophea Soriya Sothea Sovanary Sreyneang Sreypov Theary Thida",
    "Chea Chhay Chhim Chhoeun Chhun Hem Heng Houn Huot Im Keo Khieu Kim Kong Koy Lim Long Mao Meas Men Mok Nhem Nhim Ouk Pech Pen Phan Phon Pich Ros San Sar Sen Sim Sok Son Suon Taing Tep Thach Touch Um Vann Yin Yim",
    true,
  ),
  LA: pool(
    "Anousone Bounchan Bounmy Bounthong Chanthavong Daovieng Kham Khamla Khampheng Khamsing Khamsone Khamtay Khamvanh Noy Phayvanh Phomma Phonexay Phouvanh Sengthong Somchay Somkhit Somphone Somphou Somsak Souksan Souvanh Thong Vilay Xay Xaysana",
    "Anousone Bounpheng Chansouk Daravanh Khamphanh Khamphet Khamphouy Manivanh Nang Noy Ounheuan Pheng Phonethip Phoumy Sengdao Sengmany Sengthong Somchanh Souk Souksavanh Thip Thongkham Vanida Viengkham",
    "Bounpheng Chanthavong Inthavong Keobounphanh Keola Khamsing Khounvong Manivong Ounheuan Phommachanh Phommasone Phommathat Phomphakdy Phongsavath Phouvong Sayavong Sengsavang Sengsouvanh Sihavong Sisavath Sisoulith Soulivong Souphanouvong Souvannaseng Souvannavong Thammavong Vilayvanh Vongdala Vongsavanh Xayavong",
  ),
  MM: pool(
    "Aung Bo Hein Hla Htet Htun Khin Ko Kyaw Lin Maung Min Moe Myat Naing Nyan Oo Paing Phyo Sai Sithu Soe Thant Thiha Tin Tun Wai Win Yan Ye Zaw",
    "Aye Cho Ei Hla Hnin Hsu Khin May Moe Myat Nan Naw Ni Nilar Nwe Nyein Phyu Pwint San Su Thandar Thazin Thet Thin Thiri Wai Wint Yadanar Yin Yu Zar",
    "Aung Hla Hlaing Htet Htun Kyaw Latt Lin Lwin Maung Min Moe Myint Naing Oo Phyo San Sein Soe Swe Than Thant Thein Tin Tun Wai Win Wunna Yan Ye Zaw",
  ),
  BG: pool(
    "Aleksandar Angel Anton Atanas Boris Boyan Daniel Deyan Dimitar Emil Georgi Hristo Ilian Ivan Kalin Kiril Krasimir Martin Milen Nikolay Pavel Petar Plamen Radoslav Stefan Stoyan Todor Valentin Vasil Veselin Viktor Vladimir",
    "Albena Aleksandra Aneta Anna Bilyana Borislava Daniela Desislava Elena Elitsa Emilia Gergana Iva Ivana Kalina Katerina Liliya Maria Milena Nadezhda Nevena Petya Radostina Ralitsa Silviya Stefka Teodora Tsvetana Vanya Vesela Viktoriya",
    "Aleksandrov Angelov Atanasov Borisov Boyanov Chavdarov Dimitrov Dobrev Emilov Ganchev Georgiev Hristov Iliev Ivanov Kalinov Kirilov Kolev Konstantinov Marinov Mladenov Nikolov Pavlov Petkov Petrov Popov Radev Rusev Slavov Stefanov Stoev Stoyanov Todorov Tsonev Vasilev Velikov Videnov Vladimirov Zhelyazkov",
  ),
  AL: pool(
    "Admir Adrian Agim Alban Altin Arben Ardian Ardit Arjan Artan Beni Besart Besim Bledi Dardan Dritan Edi Endrit Erion Fatmir Fatos Gazmend Gent Ilir Klajdi Luan Mentor Petrit Sokol Taulant Valon",
    "Adelina Albana Alketa Anila Arta Aulona Blerta Bora Brunilda Dafina Dajana Drita Edlira Elira Elona Eneda Erjona Erisa Esma Flora Genta Jonida Klea Liridona Majlinda Mira Rovena Rudina Teuta Valbona Vjollca",
    "Ahmeti Aliaj Basha Begu Berisha Biba Bushati Cani Cela Dervishi Doda Gashi Gjoka Hasa Hoxha Islami Kelmendi Kola Krasniqi Leka Lleshi Marku Meta Nika Nushi Osmani Pasha Prifti Rama Rraci Saliu Selimi Shala Shehu Shkodra Sula Tafaj Tola Toska Xhaferi",
  ),
  IS: pool(
    "Arnar Ari Arni Asgeir Bjarni Bjorn Einar Elias Emil Finnur Freyr Gunnar Halldor Haraldur Hrafn Ingvar Johann Jon Kari Kristjan Magnus Olafur Pall Ragnar Sigurdur Stefan Sturla Thor Valdimar",
    "Agnes Anna Arna Asdis Audur Birna Brynja Edda Elin Erla Freyja Gudrun Halla Hanna Harpa Helga Hildur Ingibjorg Johanna Katrin Lilja Ragnhildur Rannveig Sigridur Sigrun Svala Thorunn",
    "Arnarson Arnason Asgeirsson Baldursson Bjarnason Bjornsson Einarsson Emilsson Erlendsson Finnsson Geirsson Gunnarsson Gustavsson Halldorsson Haraldsson Hauksson Helgason Johannsson Jonsson Karlsson Kristjansson Magnusson Olafsson Palsson Ragnarsson Sigurdsson Stefansson Thorisson Thorsteinsson Valdimarsson",
  ),
  ET: pool(
    "Abel Abebe Abiy Alemayehu Amanuel Amare Ashenafi Assefa Bekele Berhanu Birhanu Dawit Dereje Desalegn Elias Fekadu Getachew Girma Haile Henok Ketema Kifle Mekonnen Mengistu Mesfin Mulugeta Samson Samuel Solomon Tadesse Tamrat Tesfaye Yared",
    "Abeba Addis Almaz Aster Azeb Bethlehem Birtukan Blen Emebet Eyerusalem Fana Genet Hanna Hiwot Jerusalem Liya Mahlet Mekdes Meron Mulu Rahel Sara Selam Saba Seble Senait Tigist Tirunesh Tsion Winta Yenenesh",
    "Abate Abebe Abraham Adamu Aklilu Alemu Ali Amare Assefa Ayele Bekele Berhanu Beshah Desta Eshetu Fekadu Gebre Gebremariam Getachew Girma Haile Hailu Kebede Kassa Legesse Mekonnen Mengesha Mengistu Mesfin Mohammed Nigussie Tadesse Tefera Tekle Tesfaye Worku Yilma",
  ),
  TH: pool(
    "Anan Anuchit Apichat Arthit Atthaphon Chai Chaiwat Chakrit Chanon Chanthakorn Chatchai Chatri Chawalit Chayanon Danai Ekkachai Jakkrit Kittipong Kittisak Krit Krongpol Narin Natthaphon Nattapong Nattawut Niran Noppadon Nopparat Pakorn Panuwat Patiphan Phakphum Phanuphong Phichit Phiraphat Phongphat Piyawat Pramote Prasert Ratchanon Sakchai Saksit Sarawut Sittichai Somchai Somkiat Somphon Supachai Suphakorn Surachai Surasak Tanakorn Thanakrit Thanaphon Thanawat Thawatchai Thiraphat Thitipong Warit Wichai Wirot Wisarut Yuttana",
    "Achara Anchalee Anong Apinya Araya Arisa Benjamas Bussaba Chalida Chanida Chanya Daranee Darika Duangjai Jintana Kanchana Kanda Kanyarat Karnjana Ketsara Lalita Malee Manatsan Mathinee Mayuree Nalin Natnicha Nattaya Natticha Nicha Nisa Nittaya Nonglak Onuma Orathai Patcharee Pawinee Phattharaphon Phawinee Pimchanok Pimlada Ploypailin Pornthip Praewpan Pranee Ratchada Rattana Rungnapa Sirikanya Sirin Siriporn Suda Sudarat Sunisa Supaporn Suphansa Thanyarat Thidarat Thipsuda Wanida Waranya Wassana Wilai",
    "Adisorn Akarapong Aksornchai Amornchai Anantakul Ariyapong Boonchu Boonkham Boonma Boonmee Boonprasert Boonruang Boonsong Boonsri Boonsuk Boontham Boonthong Chaicharoen Chaimongkol Chaisang Chaisri Chaiwan Chanthara Charoenkul Charoenphon Charoensuk Charoenwong Chuenchom Chutinan Dechathorn Duangchan Duangdao Duangjai Inthara Intaraprasert Jaidee Jaroenkit Kanchanakul Kaewchai Kaewdang Kaewmanee Kaewpradit Kaewsri Kaewwan Kamolrat Kerdkaew Khumdee Khumsri Kitsuwan Kongkaew Kongpet Kongthong Kongsri Kulsiri Laohakul Lertchai Limcharoen Maneerat Mongkhon Naksri Nilrat Nimsakul Panya Phanich Phanphong Phasuk Phatthanakul Phongchai Phongsiri Phromma Phromsri Poomsri Pradit Prasertsuk Promrak Raksakul Rattanakul Rattanapong Rattanawong Rojanasiri Saelim Saengchan Saengkaew Saengthong Sangchai Sangthong Sangsri Sattayakul Sawang Sriaram Srichai Srichan Srikham Srimanee Sripong Srisai Srisang Srisawat Srisuk Sritong Sriwichai Sukchai Sukdee Suksai Suksawat Sukwong Sunthorn Suwan Suwannarat Thongchai Thongdee Thongkham Thongma Thongmee Thongprasert Thongsri Thongsuk Thongthae Udomchai Udomsuk Vejjajiva Wichit Wongchai Wongdee Wongkaew Wongsawat Wongsri Wongwan Yimprasert Yimsri",
  ),
  ID: pool(
    "Aditya Agus Ahmad Andi Arif Bagus Bambang Bayu Bima Budi Dimas Eko Fajar Farhan Galih Hadi Hendri Ilham Irfan Joko Made Muhammad Putra Rahmat Raka Reza Rizky Satria Surya Wahyu Wayan Yoga Yusuf",
    "Anisa Ayu Citra Dewi Dian Dinda Eka Fitri Indah Intan Kartika Lestari Maya Melati Nabila Nadia Ni Nyoman Nurul Putri Rani Ratna Rina Sari Sekar Siti Sri Tiara Wulan Yuni",
    "Adiputra Anggara Anwar Arianto Cahyadi Darmawan Firmansyah Gunawan Hadi Hartanto Hartono Hidayat Irawan Iskandar Kurniawan Kusuma Mahendra Maulana Nugraha Nugroho Pangestu Prabowo Pradana Prakoso Prasetyo Pratama Purnama Purnomo Ramadhan Ridwan Saputra Santoso Setiawan Subagyo Sudrajat Suharto Sulaiman Surya Susanto Sutanto Utama Wibowo Wicaksono Widodo Wijaya Wirawan Yulianto",
  ),
  MY: pool(
    "Adam Adib Aiman Amir Arif Azlan Danish Farid Faris Faiz Hakim Harith Hazim Haziq Hilmi Imran Irfan Iskandar Luqman Nazri Nazrin Syafiq Syahmi Zaid Zaki",
    "Aina Aisyah Amira Anis Balqis Farah Fatimah Hani Iman Maisarah Maryam Nadia Nadhirah Najwa Nurul Qistina Sabrina Safiya Sarah Siti Sofea Syazwani Yasmin Zulaikha",
    "Abdullah Ahmad Ali Ariffin Azmi Bakri Daud Hamid Hassan Hussein Ibrahim Idris Ismail Jaafar Jalil Jamaluddin Kamaruddin Latif Mahmud Mansor Mohamad Musa Mustapha Nordin Omar Osman Othman Rahim Rahman Razak Roslan Salleh Shafie Sulaiman Tahir Yusof Zainal",
  ),
  PH: pool(
    "Adrian Angelo Antonio Carlo Carlos Christian Daniel Diego Emmanuel Enrique Francis Gabriel Jaime Joaquin Jose Juan Lorenzo Luis Manuel Marco Miguel Paolo Rafael Ramon Ricardo Roberto Rodrigo Tomas Victor Vincent",
    "Alyssa Andrea Angela Angelica Beatriz Carla Carmela Clarisse Cristina Danica Denise Elena Gabriela Isabel Jasmine Joanna Julia Katrina Lara Liza Maria Mariel Michelle Patricia Regina Sofia Teresa Vanessa Veronica",
    "Aguilar Alonzo Aquino Bautista Bernardo Cabrera Castillo Castro Chua Cojuangco Cruz David de-Guzman de-Leon del-Rosario Diaz Dizon Domingo Enriquez Escobar Espinosa Evangelista Fernandez Flores Francisco Garcia Gonzales Guevarra Gutierrez Hernandez Jacinto Jimenez Lim Lopez Luna Manalo Mendoza Mercado Miranda Navarro Ocampo Ong Padilla Perez Ramos Reyes Rivera Rodriguez Rosario Roxas Salvador Sanchez Santiago Santos Soriano Tan Tolentino Torres Valdez Valencia Vargas Velasco Villanueva Yap",
  ),
  TR: pool(
    "Ahmet Ali Alp Arda Baris Berk Bora Burak Can Cem Deniz Efe Emre Enes Eren Hakan Halil Ibrahim Kaan Kerem Mehmet Mert Murat Mustafa Omer Onur Orhan Osman Selim Serkan Tolga Ugur Yusuf",
    "Ada Ahu Aylin Ayse Banu Beril Beste Ceren Defne Deniz Derya Dilan Duygu Ece Elif Esra Eylul Gizem Gulce Hande Hazal Ipek Melis Nazli Ozge Selin Sema Sila Tugce Yasemin Zeynep",
    "Aksoy Akyuz Arslan Aslan Ates Aydin Bal Bayram Bulut Celik Cetin Ceylan Demir Deniz Dogan Durmaz Eren Erol Guler Gunes Gurbuz Kalkan Kaplan Karaca Karatas Kaya Keskin Kilic Koc Korkmaz Kurt Ozdemir Ozturk Polat Sahin Sari Simsek Tas Tekin Toprak Turan Ucar Yalcin Yaman Yavuz Yildirim Yildiz Yilmaz",
  ),
  GE: pool(
    "Aleksandre Andria Beka Davit Demetre Dito Erekle Giga Giorgi Irakli Kakha Konstantine Lasha Levan Luka Mamuka Merab Mikheil Nika Nikoloz Otar Paata Rati Revaz Saba Shota Tornike Vakhtang Zurab",
    "Ana Ani Ekaterine Elene Ketevan Lela Lika Lizi Maka Manana Mariam Megi Nata Natia Nino Nona Rusudan Salome Sophio Tamar Tamta Teona Tinatin",
    "Abashidze Beridze Chikovani Chikvaidze Chubinidze Danelia Gachechiladze Gelashvili Gigauri Gogoladze Iashvili Kalandadze Kapanadze Kavtaradze Kiknadze Kobakhidze Kutateladze Lomidze Maisuradze Makharadze Mchedlishvili Metreveli Nadiradze Nozadze Papashvili Samkharadze Shengelia Sikharulidze Tsertsvadze Tsiklauri Tskitishvili Tsurtsumia Vashakidze Zaalishvili Zivzivadze",
  ),
  AM: pool(
    "Aram Armen Artak Arsen Arthur Ashot Davit Edgar Eduard Gevorg Gor Grigor Haik Harutyun Hovhannes Karen Levon Mikael Narek Ruben Samvel Sargis Tigran Vahe Vahan Vardan",
    "Anahit Ani Anna Arpine Elen Gayane Hasmik Hripsime Karine Liana Lilit Lusine Mane Mariam Marine Naira Nare Narine Sona Siranush Susanna Tatevik",
    "Abrahamyan Akopyan Arakelyan Avagyan Avetisyan Baghdasaryan Babayan Danielyan Davtyan Ghazaryan Grigoryan Hakobyan Harutyunyan Hovhannisyan Karapetyan Khachatryan Kirakosyan Manukyan Martirosyan Melikyan Mkrtchyan Movsisyan Petrosyan Poghosyan Sahakyan Sargsyan Simonyan Stepanyan Terteryan Vardanyan",
  ),
  UA: pool(
    "Andrii Artem Bohdan Danylo Dmytro Ihor Ivan Kyrylo Maksym Marko Mykhailo Mykola Oleksandr Oleksii Oleh Pavlo Petro Roman Serhii Taras Vadym Valerii Vasyl Viktor Vitalii Volodymyr Yurii Yaroslav",
    "Alina Anastasiia Bohdana Daria Halyna Iryna Kateryna Khrystyna Lesia Liudmyla Mariia Marta Nataliia Nina Oksana Olena Olha Olesia Roksolana Solomiia Svitlana Tetiana Ulyana Valentyna Viktoriia Yana Yuliia",
    "Bondar Bondarenko Boiko Chumak Danylenko Doroshenko Fedorenko Hnatiuk Honchar Honcharenko Horbenko Hrytsenko Hrytsai Ivanenko Karpuk Koval Kovalenko Kovalchuk Kozak Kravchenko Kucher Lysenko Marchenko Melnyk Moroz Oliinyk Panchenko Pavlenko Petrenko Polishchuk Romanenko Savchenko Shevchenko Sydorenko Tkachenko Tkachuk Vovk Yaremchuk Zakharchenko",
  ),
  PL: pool(
    "Adam Adrian Andrzej Bartosz Damian Daniel Dawid Filip Grzegorz Jakub Jan Kacper Karol Krzysztof Lukasz Maciej Marcin Marek Mateusz Michal Pawel Piotr Rafal Szymon Tomasz Wojciech",
    "Agata Agnieszka Aleksandra Alicja Anna Barbara Dorota Ewa Iwona Joanna Julia Justyna Karolina Katarzyna Kinga Magdalena Malgorzata Marta Monika Natalia Patrycja Paulina Sylwia Weronika Zofia",
    "Nowak Kowalski Wisniewski Wojcik Kowalczyk Kaminski Lewandowski Zielinski Szymanski Wozniak Dabrowski Kozlowski Jankowski Mazur Wojciechowski Kwiatkowski Krawczyk Kaczmarek Piotrowski Grabowski Zajac Pawlowski Michalski Krol Wieczorek Jablonski Wrobel Nowakowski Majewski Olszewski Jaworski Malinowski Adamczyk Dudek Gorski Stepien Sikora Baran Ostrowski",
  ),
  CZ: pool(
    "Adam Ales Antonin Daniel David Filip Frantisek Jan Jakub Jiri Karel Lukas Marek Martin Matej Michal Milan Ondrej Pavel Petr Radek Roman Tomas Vaclav Vojtech Zdenek",
    "Adela Alena Anna Barbora Dagmar Denisa Eliska Eva Hana Ivana Jana Katerina Klara Lenka Lucie Marketa Marie Michaela Monika Pavla Petra Sarka Tereza Veronika Zuzana",
    "Novak Svoboda Novotny Dvorak Cerny Prochazka Kucera Vesely Horak Nemec Pokorny Marek Pospisil Hajek Jelinek Kral Ruzicka Benes Fiala Sedlacek Dolezal Zeman Kolar Navratil Cermak Urban Vanek Blazek Kolarik Kratochvil",
  ),
  FI: pool(
    "Aleksi Antti Eero Elias Henri Heikki Ilkka Jari Joonas Juha Juhani Lauri Markus Matti Mika Mikko Olli Pekka Petri Risto Sami Tapio Teemu Timo Tuomas Valtteri Ville",
    "Aino Anna Anni Elina Emilia Essi Hanna Heidi Iida Inka Jenna Johanna Katri Laura Liisa Maija Maria Marika Minna Noora Outi Paivi Riikka Salla Sari Satu Tuuli",
    "Aalto Aaltonen Heikkinen Hietala Holopainen Jokinen Kallio Karjalainen Kinnunen Koivisto Korhonen Koskinen Laakso Laaksonen Lahtinen Lehtinen Lehto Lehtonen Lindholm Makela Makinen Miettinen Niemi Nieminen Nurmi Ojala Paavola Rantanen Rautiainen Saarinen Salminen Salo Seppala Suomi Toivonen Tuominen Virtanen",
  ),
  EE: pool(
    "Andres Ardo Erik Hannes Indrek Jaan Janno Karl Kaspar Kristo Lauri Madis Mait Margus Marko Mart Martin Mihkel Peeter Priit Raivo Rasmus Rein Siim Taavi Tarmo Toomas",
    "Anu Ave Egle Eili Eleri Evelin Helen Janika Kadri Kairi Karin Kati Katrin Kerli Kristi Laura Liina Maarja Maris Merle Piret Reelika Riina Sirli Triin Tuuli",
    "Aas Ilves Jogi Kallas Kask Kivi Koiv Kuusk Laas Lepp Liiv Lill Luik Maagi Magi Metsa Oja Ots Paju Parn Peterson Pold Ratas Rebane Saar Sepp Sild Tamm Teder Toom Toots Vaher Vaino Valk",
  ),
  LV: pool(
    "Aigars Aivars Andris Artis Dainis Edgars Emils Gatis Girts Ivars Janis Juris Karlis Kaspars Kristaps Lauris Martins Maris Oskars Peteris Raimonds Rihards Roberts Toms Valdis",
    "Agnese Aija Alina Anete Dace Daina Elina Evija Ilze Inese Inga Jana Kristine Laima Laura Liga Liene Linda Madara Mara Marta Rasa Sandra Santa Zane",
    "Abolins Balodis Berzins Eglitis Jansons Kalnins Karklins Krumins Lapins Liepins Ozolins Ozols Petersons Priede Rudzitis Silins Sprogis Strautins Vanags Vasiljevs Vitols Ziedins",
  ),
  LT: pool(
    "Algirdas Andrius Antanas Arnas Arturas Audrius Dainius Darius Donatas Edvinas Gediminas Giedrius Ignas Jonas Julius Justas Karolis Kestutis Mantas Mindaugas Paulius Rokas Saulius Tomas Vytautas Zilvinas",
    "Aiste Akvile Alma Ausra Daiva Dalia Egle Emilija Gabija Gintare Greta Ieva Indre Inga Justina Karolina Kristina Lina Monika Rasa Ruta Simona Ugne Vaida Viktorija",
    "Adomaitis Balciunas Baltrunas Butkus Jankauskas Januskevicius Jurgaitis Kazlauskas Kavaliauskas Kucinskas Laurinaitis Matulis Petrauskas Petraitis Sabonis Sakalauskas Stankevicius Tamulis Vaitkus Valaitis Zilinskas Zukauskas",
  ),
  AZ: pool(
    "Adil Anar Asif Aydin Elchin Eldar Emin Farhad Farid Fuad Ilgar Ilham Kamran Murad Nadir Nijat Orkhan Rashad Rauf Ruslan Samir Tural Vugar",
    "Aygun Aysel Aynur Dilara Fidan Gunay Gulnar Jamila Lala Leyla Narmin Nigar Sabina Samira Sevda Shabnam Turkan Ulviyya Zeynab",
    "Abbasov Ahmadov Aliyev Asadov Babayev Bayramov Guliyev Hasanov Huseynov Ibrahimov Ismayilov Jafarov Karimov Mammadov Mirzayev Musayev Nabiyev Orujov Pashayev Rahimov Rasulov Safarov Salimov Valiyev",
  ),
  KZ: pool(
    "Adil Aidar Alikhan Aman Arman Askar Azamat Bakyt Daniyar Daulet Dias Erasyl Ilyas Kanat Madi Marat Nurlan Ruslan Sanzhar Serik Sultan Timur Yerlan Yersultan Zhasulan",
    "Aigerim Aiman Ainur Aisulu Aliya Aruzhan Asem Assel Dana Dariga Diana Dinara Gulmira Kamila Madina Malika Meruert Nazira Sabina Saltanat Saule Tomiris Zhanar Zarina",
    "Abdullayev Abishev Akhmetov Alimov Asanov Baimukhanov Beketov Iskakov Kairatov Karimov Kasymov Kenesov Kozhakhmetov Mukhanov Nurgaliyev Ospanov Sadykov Sagyndykov Serikov Smagulov Tulegenov Yermekov Zhaksybekov Zhumabayev",
  ),
  UZ: pool(
    "Abbos Akbar Alisher Anvar Aziz Bekzod Bobur Dilshod Doston Farrukh Islom Jamshid Jasur Laziz Miraziz Nodir Odil Otabek Oybek Rustam Sanjar Sardor Shavkat Ulugbek",
    "Aziza Dildora Dilnoza Feruza Gulbahor Gulnora Guzal Kamola Madina Malika Mohira Munisa Nafisa Nargiza Nilufar Nodira Rayhona Saida Shahnoza Sitora Umida Yulduz Zilola",
    "Abdullayev Ahmedov Alimov Ashurov Ergashev Gafurov Hasanov Ismailov Juraev Karimov Mamatov Mirzaev Muradov Nazarov Rahimov Rasulov Rustamov Saidov Salimov Shamsiev Sharipov Tashmatov Tursunov Usmanov Yuldashev",
  ),
  BD: pool(
    "Abir Anik Anis Arif Ashiq Ayon Fahim Farhan Hasan Imran Mahmud Mehedi Nabil Nasir Rafi Rahat Raihan Rashed Saif Sakib Shahid Shakil Tanvir Tariq Wasif Zubair",
    "Afsana Ayesha Brishti Farhana Fatema Ishrat Jannat Lamia Mahira Maliha Mitu Nadia Nafisa Nahar Nargis Nusrat Raisa Rima Sabina Sadia Samira Sanjida Shabnam Tania Tasnim",
    "Ahmed Akhtar Alam Ali Amin Azad Bari Bashar Biswas Chowdhury Das Haque Hasan Hossain Islam Jahan Kabir Karim Khan Mahmud Majumdar Miah Mirza Mondal Rahman Rashid Roy Sarkar Sarker Shah Talukder Uddin",
  ),
  PK: pool(
    "Abdullah Adil Ahsan Ali Amir Asad Bilal Danish Fahad Farhan Hamza Haris Hasan Imran Irfan Kamran Kashif Mohsin Nabeel Naveed Omar Rizwan Saad Salman Shahid Shoaib Usman Waqas Yasir Zain",
    "Aiman Aisha Alina Amna Anam Aqsa Areeba Ayesha Fatima Hania Hira Iqra Kinza Laiba Mahnoor Maria Maryam Mehwish Minahil Nimra Noor Rabia Rida Saba Sadia Sana Sidra Zainab",
    "Abbasi Ahmed Akhtar Ali Amin Aslam Awan Aziz Bajwa Bashir Bhatti Chaudhry Dar Farooq Gill Haider Hussain Iqbal Javed Khan Malik Mir Mughal Naeem Nawaz Qureshi Raza Rizvi Shah Sheikh Siddiqui Tariq Ullah Yousaf",
  ),
  NP: pool(
    "Aakash Abhishek Ajay Amrit Anil Arjun Ashish Bikash Bijay Binod Bishal Deepak Dinesh Gopal Hari Kiran Krishna Mahesh Milan Nabin Niraj Prakash Pramod Rajan Ramesh Sagar Santosh Suman Sunil Suraj",
    "Anita Anjana Anju Archana Asha Binita Deepa Gita Indira Kamala Karuna Laxmi Manisha Mina Nirmala Pooja Pramila Rachana Rekha Sabina Sabitri Samjhana Sangita Sharmila Shristi Sita Sunita Sushma",
    "Acharya Adhikari Aryal Bhandari Bhattarai Bhusal Dahal Devkota Dhakal Gautam Ghimire Gurung Joshi Karki Kattel KC Khadka Koirala Lama Magar Mainali Nepal Pandey Paudel Pokharel Poudel Rai Regmi Rijal Shahi Sharma Shrestha Subedi Tamang Thapa Tiwari",
  ),
  LK: pool(
    "Akila Amila Anjana Aruna Ashan Chamal Chamara Chathura Dhanushka Dilshan Dimuth Dinuka Dulan Hasitha Isuru Kavindu Lahiru Malith Nalin Nimesh Nipun Pasindu Pramod Ruwan Sachith Sahan Sameera Tharindu Udara",
    "Achini Amaya Anjali Anusha Bhagya Chamari Chathurika Dilini Dinithi Dulani Hansika Harini Hashini Hiruni Ishara Kaushalya Madhavi Nadeesha Nethmi Nilushi Oshadi Pavithra Sachini Sanduni Shashini Tharushi Upeksha",
    "Abeyratne Bandara Chandrasiri Dahanayake de-Silva Dissanayake Ekanayake Fernando Gamage Gunasekara Jayasinghe Karunaratne Kumarasinghe Madushanka Mendis Nanayakkara Pathirana Perera Premadasa Rajapaksha Ranasinghe Ratnayake Samarakoon Senanayake Silva Siriwardena Subasinghe Weerasinghe Wijesinghe",
  ),
  NG: pool(
    "Adebayo Adekunle Adewale Chibueze Chidi Chinedu Chukwudi Emeka Femi Ifeanyi Ikechukwu Kehinde Kunle Obinna Olumide Oluwaseun Segun Tobi Uche Victor Yusuf",
    "Ada Adaeze Adanna Aisha Amaka Amarachi Amina Bimpe Chioma Chisom Funke Ifeoma Kemi Nneka Ngozi Olamide Omolara Temitope Yetunde Zainab",
    "Abiola Adebayo Adegoke Adekunle Adeleke Adeniyi Adeola Adewale Adeyemi Ajayi Akande Akinola Akinwale Balogun Eze Ezeh Ikechukwu Nwafor Nwankwo Nwosu Obi Obiora Okafor Okechukwu Okeke Okonkwo Okoye Oladipo Olayinka Olorunfemi Onwuegbuzie Onyekachi Osagie Uche Udo Usman",
  ),
  GH: pool(
    "Agyeman Akwasi Collins Daniel Emmanuel Eric Francis Joseph Kofi Kojo Kwabena Kwadwo Kwame Kwesi Kweku Nana Owusu Richard Samuel Yaw",
    "Abena Adjoa Afia Akosua Ama Amma Esi Esther Gifty Grace Maame Mavis Nana Rebecca Serwaa Vida Yaa",
    "Aboagye Acheampong Addo Agyeman Aidoo Akoto Amankwah Amoako Ankomah Ansah Antwi Appiah Asamoah Asante Boateng Darko Frimpong Gyan Gyasi Koomson Mensah Ofori Osei Owusu Quartey Sarpong Tetteh Yeboah",
  ),
  KE: pool(
    "Alex Anthony Brian David Dennis George James John Joseph Kamau Kariuki Kevin Kiptoo Maina Martin Michael Mwangi Njoroge Otieno Peter Samuel Victor Wanjohi",
    "Agnes Alice Ann Beatrice Catherine Faith Grace Jane Janet Joyce Mercy Miriam Njeri Nyambura Rose Ruth Wairimu Wambui Wangari Wanjiku Wanjiru",
    "Chebet Cheruiyot Kamau Kamotho Kariuki Kimani Kipchoge Kiplagat Kiplimo Kiptoo Kirui Koech Korir Maina Makau Mburu Mugo Muriithi Mutiso Mwangi Njenga Njoroge Njuguna Nyaga Odhiambo Odongo Oduor Omondi Onyango Otieno Waweru",
  ),
  ZA: pool(
    "Andile Bongani Dumisani Jacob Johan Kabelo Khaya Lethabo Mandla Mpho Nkosinathi Pieter Sibusiso Sipho Sizwe Thabo Themba Thulani Vusi Xolani",
    "Ayanda Buhle Busisiwe Dineo Lerato Lindiwe Mandisa Mbali Nomsa Nondumiso Nosipho Palesa Precious Refilwe Sibongile Siphokazi Thandi Thandiwe Thembi Zanele Zinhle",
    "Botha Dlamini Dube du-Plessis Jacobs Khumalo Mahlangu Maseko Mkhize Mokoena Molefe Moloi Mthembu Ndlovu Ngcobo Nkosi Ntuli Shabalala Sithole van-der-Merwe Vilakazi Zulu",
  ),
};

// Keep gendered surnames and language-specific inflections local to the country.
for (const code of ["AZ", "KZ", "UZ"])
  NATIONAL_NAMES[code].femaleSurname = (s) =>
    /(?:ov|ev)$/.test(s) ? `${s}a` : s;
NATIONAL_NAMES.PL.femaleSurname = (s) =>
  /(?:ski|cki|dzki)$/.test(s) ? `${s.slice(0, -1)}a` : s;
NATIONAL_NAMES.CZ.femaleSurname = (s) =>
  s.endsWith("y")
    ? `${s.slice(0, -1)}a`
    : s.endsWith("a")
      ? `${s.slice(0, -1)}ova`
      : `${s}ova`;
NATIONAL_NAMES.LT.femaleSurname = (s) =>
  s.endsWith("ius")
    ? `${s.slice(0, -3)}iute`
    : s.endsWith("us")
      ? `${s.slice(0, -2)}ute`
      : s.endsWith("as")
        ? `${s.slice(0, -2)}aite`
        : /(?:is|ys)$/.test(s)
          ? `${s.slice(0, -2)}yte`
          : s;
NATIONAL_NAMES.LV.femaleSurname = (s) =>
  s.endsWith("sons")
    ? `${s.slice(0, -1)}e`
    : s.endsWith("is")
      ? `${s.slice(0, -2)}e`
      : s.endsWith("s")
        ? `${s.slice(0, -1)}a`
        : s;
NATIONAL_NAMES.BG.femaleSurname = (s) => (/(?:ov|ev)$/.test(s) ? `${s}a` : s);
NATIONAL_NAMES.IS.femaleSurname = (s) => s.replace(/sson$/, "sdottir");

export const EXTRA_NAMES: Record<string, Partial<NameCulture>> = {
  anglo: {
    male: words(
      "Adam Aaron Adrian Andrew Anthony Benjamin Christopher Charles David Ethan George Isaac Jacob Jonathan Joseph Joshua Leo Matthew Michael Nathan Nicholas Oscar Patrick Peter Robert Sebastian Simon Stephen Theo Timothy Zachary",
    ),
    female: words(
      "Abigail Alice Amelia Amy Audrey Bethany Clara Daisy Elizabeth Emily Evelyn Fiona Florence Imogen Isabel Jessica Katherine Leah Lily Louise Lydia Madeline Matilda Natalie Phoebe Rachel Rebecca Rose Ruby Victoria Zoe",
    ),
    surnames: words(
      "Adams Allen Anderson Armstrong Bailey Baker Barnes Bell Brooks Campbell Carter Chapman Collins Cook Cooper Cox Davidson Davies Dawson Dixon Douglas Duncan Edwards Elliott Ellis Fisher Fletcher Ford Freeman Gibson Graham Grant Gray Green Griffin Hall Hamilton Harrison Hart Harvey Hayes Henderson Hill Holmes Howard Hunter Jackson Jenkins Johnson Jones Kelly Kennedy King Knight Lane Lawrence Lee Lewis Lloyd Marshall Martin Mason Matthews Miller Moore Morgan Morris Murphy Murray Nelson Newman Parker Patterson Pearson Perry Phillips Powell Price Richardson Roberts Robinson Rogers Ross Russell Scott Shaw Simpson Spencer Stevens Stewart Stone Sullivan Turner Watson Webb Wells West White Williams Wood Wright Young",
    ),
  },
  eastslavic: {
    male: words(
      "Alexander Anatoly Anton Arkady Artyom Boris Daniil Denis Fyodor Georgy Grigory Ilya Kirill Konstantin Leonid Nikita Roman Ruslan Semyon Stanislav Stepan Vadim Valery Vasily Vyacheslav Yaroslav",
    ),
    female: words(
      "Alexandra Alina Alisa Anastasia Angelina Arina Ekaterina Elizaveta Galina Ksenia Larisa Lyubov Lyudmila Margarita Nina Polina Raisa Sofia Valentina Vasilisa Viktoria Yulia Zinaida Zoya",
    ),
    surnames: words(
      "Abramov Alexandrov Alexeyev Antonov Belov Belyaev Bogdanov Borisov Danilov Denisov Dmitriev Drozdov Fedotov Filatov Fomin Frolov Gavrilov Gerasimov Golubev Gorbunov Grigoriev Gusev Ignatov Ilyin Kalinin Kalashnikov Karpov Kazakov Kiselev Klimov Komarov Konovalov Korolev Kotov Krylov Kudryavtsev Kulikov Lazarev Makarov Markov Maslov Matveev Medvedev Mikhailov Nikitin Nikiforov Nosov Osipov Pavlov Polyakov Ponomarev Rodionov Romanov Ryabov Ryabinin Savelyev Semenov Sergeev Shestakov Shishkin Sidorov Silin Simonov Solovyov Sorokin Stepanov Tarasov Timofeyev Titov Trofimov Vasiliev Vinogradov Vorobyov Voronin Yakovlev Yegorov Yefimov Zakharov Zhuravlev Zimin Zubov",
    ),
  },
  indian: {
    male: words(
      "Abhinav Abhishek Akash Akhil Amit Anirudh Anish Ankit Ashwin Ayush Deepak Dev Devansh Dhruv Gaurav Harsha Hemant Jai Jayant Kabir Kunal Madhav Manish Mayank Mohan Mukund Naveen Nishant Parth Raghav Raj Rajat Rajesh Rakesh Ravi Rohit Sachin Sagar Sahil Sai Samarth Sanjay Sarthak Shreyas Shubham Sohan Sourav Suraj Tanmay Varun Vedant Vijay Vinay Vivek Yash",
    ),
    female: words(
      "Aditi Akshara Anjali Ankita Aparna Bhavna Charu Deepa Deepti Diya Garima Gayatri Harini Isha Jaya Kiran Kritika Lavanya Madhavi Malini Manisha Megha Neha Niharika Pallavi Parvati Preeti Radhika Rhea Ritika Roshni Saanvi Sakshi Sanjana Saumya Shalini Shreya Simran Smriti Srishti Swati Tanvi Vaishnavi Vidya",
    ),
    surnames: words(
      "Acharya Agarwal Ahuja Anand Arora Bansal Basu Bhat Bhattacharya Bhatt Chakraborty Chauhan Chavan Das Dasgupta Dutta Ghosh Goel Gokhale Goswami Jain Jaiswal Jha Joshi Kapoor Khanna Kohli Kumar Mahajan Malhotra Mishra Mukherjee Mukhopadhyay Naik Narayan Pandey Pandit Parekh Patil Prasad Rana Rastogi Rathore Roy Saha Saxena Sen Shah Shinde Sinha Sridhar Srivastava Thakur Tripathi Trivedi Tyagi Vaidya Venkatesh Wagh Yadav",
    ),
  },
  chinese: {
    male: words(
      "Bohan Chengyu Guowei Haoyu Hongyi Jiaming Jiarui Jianyu Jinghao Jinpeng Junhao Kaiwen Minghao Pengfei Qingyang Ruichen Ruihan Shaohua Siyuan Tianhao Weijie Wenbo Wenhao Xiaoyu Xinyi Xudong Yifan Yiheng Yiming Yongqiang Yuanhang Zexuan Zhaohui Zhenyu Ziyang",
    ),
    female: words(
      "Anqi Bingbing Chunyan Fangfei Huiwen Jiaqi Jiayi Jingyi Keqin Lihua Linlin Mengyao Minyi Peiyu Qianyi Qingwen Ruolan Shanshan Shiyu Tingting Wanqing Wenjing Xiaohui Xiaoting Xinyue Xueyi Yahan Yaqi Yijun Yuxin Ziqi",
    ),
    surnames: words(
      "Gao Lin He Guo Luo Zheng Liang Xie Song Tang Han Feng Yu Dong Xiao Cheng Cao Yuan Deng Xu Fu Shen Zeng Peng Lu Su Jiang Cai Pan Tian Du Ding Yao Fan Jin Shi Dai Wei Qian Hou Meng Long Qin Yan Xiong Bai Hao Cui Kang",
    ),
  },
  hispanic: {
    male: words(
      "Adrian Alberto Alvaro Antonio Cesar Cristian David Eduardo Esteban Fernando Francisco Gabriel Hector Hugo Ignacio Ivan Jaime Joaquin Jorge Jose Juan Leonardo Manuel Mario Martin Mauricio Nicolas Oscar Pedro Raul Ricardo Roberto Rodrigo Ruben Salvador Sebastian Sergio Tomas Vicente Victor",
    ),
    female: words(
      "Adriana Alejandra Alicia Ana Andrea Angela Beatriz Blanca Carolina Catalina Clara Claudia Cristina Dolores Esperanza Eva Gabriela Ines Irene Isabel Jimena Julia Laura Leticia Lola Lorena Lourdes Luisa Maria Marisol Natalia Nuria Patricia Pilar Raquel Rocio Rosa Sandra Silvia Teresa Verónica",
    ),
    surnames: words(
      "Aguilar Alonso Alvarez Arias Benitez Blanco Cabrera Calvo Cano Cardenas Carrasco Castro Cortes Cruz Delgado Diaz Dominguez Duran Espinoza Flores Fuentes Gallego Gil Gomez Gonzalez Guerrero Gutierrez Hernandez Iglesias Jimenez Leon Luna Marquez Medina Mendez Mendoza Montero Morales Moreno Munoz Nunez Paredes Pascual Pena Perez Ramirez Ramos Reyes Rios Rivera Robles Rojas Ruiz Salazar Salinas Santos Serrano Silva Soler Suarez Valdez Valencia Vazquez Vega Velasco Vidal Villanueva Zamora",
    ),
  },
};
