{
 "patcher": {
  "fileversion": 1,
  "appversion": {
   "major": 9,
   "minor": 1,
   "revision": 5,
   "architecture": "x64",
   "modernui": 1
  },
  "classnamespace": "box",
  "rect": [
   40,
   40,
   1600,
   1000
  ],
  "openinpresentation": 1,
  "default_fontsize": 10,
  "default_fontname": "Arial",
  "gridsize": [
   8,
   8
  ],
  "boxes": [
   {
    "box": {
     "id": "obj-1",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 1,
     "patching_rect": [
      20,
      20,
      54,
      22
     ],
     "text": "midiin",
     "outlettype": [
      "int"
     ]
    }
   },
   {
    "box": {
     "id": "obj-2",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 0,
     "patching_rect": [
      20,
      520,
      61,
      22
     ],
     "text": "midiout"
    }
   },
   {
    "box": {
     "id": "obj-3",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 5,
     "patching_rect": [
      300,
      420,
      170,
      22
     ],
     "text": "v8 sv_rs_v8.js",
     "outlettype": [
      "",
      "",
      "",
      "",
      ""
     ]
    }
   },
   {
    "box": {
     "id": "obj-4",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 3,
     "patching_rect": [
      300,
      20,
      117,
      22
     ],
     "text": "live.thisdevice",
     "outlettype": [
      "bang",
      "int",
      "int"
     ]
    }
   },
   {
    "box": {
     "id": "obj-5",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 1,
     "patching_rect": [
      300,
      60,
      68,
      22
     ],
     "text": "deferlow",
     "outlettype": [
      ""
     ]
    }
   },
   {
    "box": {
     "id": "obj-6",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 2,
     "patching_rect": [
      300,
      100,
      47,
      22
     ],
     "text": "t b b",
     "outlettype": [
      "bang",
      "bang"
     ]
    }
   },
   {
    "box": {
     "id": "obj-7",
     "maxclass": "message",
     "numinlets": 2,
     "numoutlets": 1,
     "patching_rect": [
      300,
      140,
      40,
      22
     ],
     "text": "init",
     "outlettype": [
      ""
     ]
    }
   },
   {
    "box": {
     "id": "obj-8",
     "maxclass": "message",
     "numinlets": 2,
     "numoutlets": 1,
     "patching_rect": [
      420,
      140,
      215,
      22
     ],
     "text": "presets_dict ---sv_rs_presets",
     "outlettype": [
      ""
     ]
    }
   },
   {
    "box": {
     "id": "obj-9",
     "maxclass": "newobj",
     "numinlets": 2,
     "numoutlets": 4,
     "patching_rect": [
      420,
      180,
      200,
      22
     ],
     "text": "dict ---sv_rs_presets @embed 1",
     "outlettype": [
      "dictionary",
      "",
      "",
      ""
     ]
    }
   },
   {
    "box": {
     "id": "obj-10",
     "maxclass": "newobj",
     "numinlets": 7,
     "numoutlets": 2,
     "patching_rect": [
      20,
      470,
      82,
      22
     ],
     "text": "midiformat",
     "outlettype": [
      "int",
      ""
     ]
    }
   },
   {
    "box": {
     "id": "obj-11",
     "maxclass": "v8ui",
     "numinlets": 1,
     "numoutlets": 1,
     "patching_rect": [
      600,
      600,
      860,
      169
     ],
     "outlettype": [
      ""
     ],
     "presentation": 1,
     "presentation_rect": [
      0,
      0,
      860,
      169
     ],
     "filename": "sv_rs_ui.js",
     "jsarguments": [
      "strip"
     ],
     "parameter_enable": 0,
     "textfile": {
      "filename": "sv_rs_ui.js",
      "flags": 0,
      "embed": 0,
      "autowatch": 1
     }
    }
   },
   {
    "box": {
     "id": "obj-12",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 1,
     "patching_rect": [
      600,
      470,
      110,
      22
     ],
     "text": "prepend status",
     "outlettype": [
      ""
     ]
    }
   },
   {
    "box": {
     "id": "obj-13",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 9,
     "patching_rect": [
      600,
      820,
      560,
      22
     ],
     "text": "route p_destino p_armonia p_raiz p_escala p_ritmo p_repeticiones p_semilla open_panel",
     "outlettype": [
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      ""
     ]
    }
   },
   {
    "box": {
     "id": "obj-14",
     "maxclass": "live.menu",
     "numinlets": 1,
     "numoutlets": 3,
     "patching_rect": [
      600,
      880,
      100,
      18
     ],
     "outlettype": [
      "",
      "",
      "float"
     ],
     "parameter_enable": 1,
     "saved_attribute_attributes": {
      "valueof": {
       "parameter_longname": "Destino",
       "parameter_shortname": "Destino",
       "parameter_type": 2,
       "parameter_enum": [
        "Bassline",
        "Chords",
        "Arpeggio",
        "Hi-hats",
        "Ethnic drums",
        "Others"
       ],
       "parameter_mmax": 5,
       "parameter_initial_enable": 1,
       "parameter_initial": [
        1
       ]
      }
     }
    }
   },
   {
    "box": {
     "id": "obj-15",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 1,
     "patching_rect": [
      600,
      920,
      110,
      22
     ],
     "text": "prepend destination_index",
     "outlettype": [
      ""
     ]
    }
   },
   {
    "box": {
     "id": "obj-16",
     "maxclass": "live.menu",
     "numinlets": 1,
     "numoutlets": 3,
     "patching_rect": [
      720,
      880,
      100,
      18
     ],
     "outlettype": [
      "",
      "",
      "float"
     ],
     "parameter_enable": 1,
     "saved_attribute_attributes": {
      "valueof": {
       "parameter_longname": "Armonía",
       "parameter_shortname": "Armonía",
       "parameter_type": 2,
       "parameter_enum": [
        "Manual",
        "Live 12",
        "Adaptable",
        "Random"
       ],
       "parameter_mmax": 3,
       "parameter_initial_enable": 1,
       "parameter_initial": [
        0
       ]
      }
     }
    }
   },
   {
    "box": {
     "id": "obj-17",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 1,
     "patching_rect": [
      720,
      920,
      110,
      22
     ],
     "text": "prepend harmony_mode_index",
     "outlettype": [
      ""
     ]
    }
   },
   {
    "box": {
     "id": "obj-18",
     "maxclass": "live.menu",
     "numinlets": 1,
     "numoutlets": 3,
     "patching_rect": [
      840,
      880,
      100,
      18
     ],
     "outlettype": [
      "",
      "",
      "float"
     ],
     "parameter_enable": 1,
     "saved_attribute_attributes": {
      "valueof": {
       "parameter_longname": "Raíz",
       "parameter_shortname": "Raíz",
       "parameter_type": 2,
       "parameter_enum": [
        "C",
        "C#",
        "D",
        "Eb",
        "E",
        "F",
        "F#",
        "G",
        "Ab",
        "A",
        "Bb",
        "B"
       ],
       "parameter_mmax": 11,
       "parameter_initial_enable": 1,
       "parameter_initial": [
        0
       ]
      }
     }
    }
   },
   {
    "box": {
     "id": "obj-19",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 1,
     "patching_rect": [
      840,
      920,
      110,
      22
     ],
     "text": "prepend root_note",
     "outlettype": [
      ""
     ]
    }
   },
   {
    "box": {
     "id": "obj-20",
     "maxclass": "live.menu",
     "numinlets": 1,
     "numoutlets": 3,
     "patching_rect": [
      960,
      880,
      100,
      18
     ],
     "outlettype": [
      "",
      "",
      "float"
     ],
     "parameter_enable": 1,
     "saved_attribute_attributes": {
      "valueof": {
       "parameter_longname": "Escala",
       "parameter_shortname": "Escala",
       "parameter_type": 2,
       "parameter_enum": [
        "Mayor (jónico)",
        "Dórico",
        "Frigio",
        "Lidio",
        "Mixolidio",
        "Menor natural (eólico)",
        "Locrio",
        "Pentatónica mayor",
        "Pentatónica menor",
        "Blues menor",
        "Blues mayor",
        "Pentatónica suspendida",
        "Menor armónica",
        "Menor melódica (ascendente)",
        "Mayor armónica",
        "Dórico #4",
        "Frigio dominante",
        "Lidio aumentado",
        "Lidio dominante",
        "Superlocrio (alterada)",
        "Menor húngara",
        "Doble armónica",
        "Tonos enteros",
        "Disminuida semitono-tono",
        "Disminuida tono-semitono",
        "Aumentada (hexatónica)",
        "Messiaen modo 3",
        "Cromática",
        "Española de 8 notas",
        "Hirajōshi",
        "In-sen",
        "Iwato",
        "Kumoi",
        "Maqam ʿAjam",
        "Maqam Nahawand",
        "Maqam Kurd",
        "Maqam Ḥijāz",
        "Maqam Rast",
        "Maqam Bayātī",
        "Maqam Ṣabā",
        "Bilawal (thaat)",
        "Kalyan / Yaman (thaat)",
        "Khamaj (thaat)",
        "Kafi (thaat)",
        "Asavari (thaat)",
        "Bhairavi (thaat)",
        "Bhairav (thaat)",
        "Purvi (thaat)",
        "Marwa (thaat)",
        "Todi (thaat)",
        "Bhupali",
        "Malkauns",
        "Slendro (aprox.)",
        "Pelog selisir (aprox.)",
        "Pelog tembung (aprox.)"
       ],
       "parameter_mmax": 54,
       "parameter_initial_enable": 1,
       "parameter_initial": [
        5
       ]
      }
     }
    }
   },
   {
    "box": {
     "id": "obj-21",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 1,
     "patching_rect": [
      960,
      920,
      110,
      22
     ],
     "text": "prepend scale_index",
     "outlettype": [
      ""
     ]
    }
   },
   {
    "box": {
     "id": "obj-22",
     "maxclass": "live.menu",
     "numinlets": 1,
     "numoutlets": 3,
     "patching_rect": [
      1080,
      880,
      100,
      18
     ],
     "outlettype": [
      "",
      "",
      "float"
     ],
     "parameter_enable": 1,
     "saved_attribute_attributes": {
      "valueof": {
       "parameter_longname": "Ritmo",
       "parameter_shortname": "Ritmo",
       "parameter_type": 2,
       "parameter_enum": [
        "Dembow (grilla CIC) (CIC.6.1)",
        "Samba: surdo (CIC.6.2)",
        "Samba: tamborim y partido alto (CIC.6.2)",
        "Maracatu de baque virado (CIC.6.3)",
        "Candombe (CIC.6.4)",
        "Cumbia (CIC.6.5)",
        "Festejo y landó (CIC.6.6)",
        "Huayno (CIC.6.7)",
        "Aksak 5/8 (2+3) (MET.3.3)",
        "Aksak 7/8 (2+2+3) (MET.3.3)",
        "Aksak 7/8 (3+2+2) (MET.3.3)",
        "Aksak 9/8 (2+2+2+3) (MET.3.3)",
        "Aksak 11/8 (2+2+3+2+2) (MET.3.3)",
        "Amalgama 5/4 (3/4 + 2/4) (MET.3.1)",
        "Tresillo (3+3+2) (CIC.3.1)",
        "Habanera (CIC.3.2)",
        "Cinquillo (CIC.3.3)",
        "Son clave 3-2 (CIC.3.4)",
        "Son clave 2-3 (CIC.3.7)",
        "Rumba clave 3-2 (CIC.3.5)",
        "Bossa clave (CIC.3.6)",
        "Standard pattern (12 pulsos) (CIC.2.1)",
        "Lancaran (16 pulsos) (CIC.5)",
        "Ketawang (16 pulsos) (CIC.5)",
        "Ladrang (32 pulsos) (CIC.5)",
        "Dub techno (base) (RGG.10.2)",
        "Stab: 1, «y» del 2, «y» del 4 (RGG.10.2)",
        "Stab: 1 y «y» del 3 (RGG.10.2)",
        "Stab: 1, 6, 11 (3+5+…) (RGG.10.2)",
        "Stab denso (seis ataques) (RGG.10.2)",
        "Stab en corcheas continuas (RGG.10.2)",
        "Colchón de acorde (RGG.10.2)",
        "Stab generativo (pesos del corpus) (RGG.10.2)",
        "Bajo de dub techno en contratiempo (RGG.10.2)",
        "Bajo de semicorcheas con swing (RGG.10.2)",
        "Soleá (CIC.7)",
        "Alegrías y cantiñas (CIC.7)",
        "Bulería (base) (CIC.7)",
        "Seguiriya (CIC.7)",
        "Four-on-the-floor (GRV.1)",
        "Backbeat (GRV.2)",
        "Half-time (GRV.3)",
        "Shuffle (tresillos) (GRV.4)",
        "One drop (grilla GRV) (GRV.5)",
        "Rockers (grilla GRV) (GRV.6)",
        "Steppers (grilla GRV) (GRV.7)",
        "Skank (grilla GRV) (GRV.8)",
        "Trap (GRV.9)",
        "Motorik (GRV.10)",
        "Breakbeat / Amen (GRV.11)",
        "2-step / UK garage (GRV.12)",
        "Bajo Moroder (GRV.13)",
        "Dub techno (grilla GRV) (GRV.14)",
        "Maqsum (CIC.4.3.1)",
        "Baladi / Masmudi saghir (CIC.4.3.2)",
        "Saidi (CIC.4.3.3)",
        "Malfuf (CIC.4.3.4)",
        "Wahda (CIC.4.3.5)",
        "Fox (CIC.4.3.6)",
        "Sama'i thaqil (10/8) (CIC.4.3.7)",
        "Usul aksak (9/8) (CIC.4.4)",
        "Usul curcuna (10/8) (CIC.4.4)",
        "Jinyangjo (24) (CIC.4.5)",
        "Jungmori (12) (CIC.4.5)",
        "Semachi (3 pulsos ternarios) (CIC.4.5)",
        "Eotmori (10/8) (CIC.4.5)",
        "Jajinmori (4 pulsos ternarios) (CIC.4.5)",
        "Bombo de bossa / baião (CIC.6.2)",
        "Cross-stick de bossa (2 compases) (CIC.3.6)",
        "Cencerro en negras y campana a contratiempo (CIC.6)",
        "Bombo de corchea con puntillo y semicorchea (CIC.6)",
        "Güiro (CIC.6)",
        "Congas: abierta, apagada y grave (CIC.6)",
        "Agogó (2 compases) (CIC.6)",
        "Capas agudas: ride, cabasa y maracas (CIC.6)",
        "Kit latino en 6/8 (MET.2.4)",
        "Campana y woodblock en 12/8 (MET.2.4)",
        "Triángulo en 9/8 (MET.3.3)",
        "E(3,8) (PRO.1)",
        "E(5,8) (PRO.1)",
        "E(7,12) (PRO.1)",
        "E(5,16) (PRO.1)",
        "Euclidiano libre E(k,n) (PRO.1)",
        "Modo rítmico 1 (largo–breve) (PRO.3)",
        "Modo rítmico 2 (breve–largo) (PRO.3)",
        "Modo rítmico 3 (largo con puntillo–breve–largo) (PRO.3)",
        "Modo rítmico 4 (breve–largo–largo con puntillo) (PRO.3)",
        "Modo rítmico 5 (largo–largo) (PRO.3)",
        "Modo rítmico 6 (breve–breve–breve) (PRO.3)",
        "Polirritmia 3:2 (SUP.1.1)",
        "Polirritmia 4:3 (SUP.1.2)",
        "Polimetría 16 contra 12 (SUP.2.1)",
        "Desplazamiento discreto (tipo Clapping Music) (PRO.11)",
        "One drop (RGG.3.1)",
        "Rockers (acepción pedagógica) (RGG.3.2a)",
        "Rockers (Channel One, 1976) (RGG.3.2b)",
        "Steppers (RGG.3.3)",
        "Steppers con empuje (RGG.3.3)",
        "Half drop / two drop (RGG.3.4)",
        "Hat en corcheas cerradas (RGG.4.1)",
        "Hat en corcheas con swing (RGG.4.2)",
        "Hat en contratiempo (RGG.4.2)",
        "Flying cymbal (flyers) (RGG.4.3)",
        "Relleno de hat en tresillo (RGG.4.4)",
        "Hat en semicorcheas digitales (RGG.4.5)",
        "Doble semicorchea a contratiempo (RGG.4.5)",
        "Hat abierto en el contratiempo de 1 y 3 (RGG.4.1)",
        "Percusión menor de dub (RGG.7)",
        "Skank en contratiempo (RGG.6.1)",
        "Chop en 2 y 4 (RGG.6.2)",
        "Double skank (RGG.6.2)",
        "Bubble de órgano (RGG.6.3)",
        "Strum de semicorchea (RGG.6.4)",
        "Bajo de roots con espacio (RGG.5.3)",
        "Sub de dub en 1 y 3 (RGG.5.4)",
        "Dubstep (medio tiempo) (RGG.10.3)",
        "Half-step de dub (RGG.10.3)",
        "Dembow (RGG.10.4)",
        "Hemiola sucesiva (6/8 → 3/4) (SUP.3.1)",
        "Birritmia simultánea (6/8 sobre 3/4) (SUP.3.2)",
        "Cueca chilena (principio) (CIC.8)",
        "Tonada chilena (principio) (CIC.8)",
        "Zamba (principio) (CIC.8)",
        "Chacarera (principio) (CIC.8)",
        "Joropo (principio) (CIC.8)",
        "Teental (16) (CIC.4.1)",
        "Jhaptal (10) (CIC.4.1)",
        "Rupak (7) (CIC.4.1)",
        "Ektal (12) (CIC.4.1)",
        "Adi tala (triputa chatusra, chatusra nadai) (CIC.4.2)",
        "Rupaka tala (chatusra jati) (CIC.4.2)",
        "Khanda jati matya (48 matras) (CIC.4.2)",
        "Misra jati jhampa (10 unidades) (CIC.4.2)"
       ],
       "parameter_mmax": 132,
       "parameter_initial_enable": 1,
       "parameter_initial": [
        32
       ]
      }
     }
    }
   },
   {
    "box": {
     "id": "obj-23",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 1,
     "patching_rect": [
      1080,
      920,
      110,
      22
     ],
     "text": "prepend pattern_index",
     "outlettype": [
      ""
     ]
    }
   },
   {
    "box": {
     "id": "obj-24",
     "maxclass": "live.menu",
     "numinlets": 1,
     "numoutlets": 3,
     "patching_rect": [
      1200,
      880,
      100,
      18
     ],
     "outlettype": [
      "",
      "",
      "float"
     ],
     "parameter_enable": 1,
     "saved_attribute_attributes": {
      "valueof": {
       "parameter_longname": "Repeticiones",
       "parameter_shortname": "Repet.",
       "parameter_type": 2,
       "parameter_enum": [
        "Auto",
        "3",
        "4",
        "8",
        "16",
        "Ciclo completo"
       ],
       "parameter_mmax": 5,
       "parameter_initial_enable": 1,
       "parameter_initial": [
        0
       ]
      }
     }
    }
   },
   {
    "box": {
     "id": "obj-25",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 1,
     "patching_rect": [
      1200,
      920,
      110,
      22
     ],
     "text": "prepend repeats_index",
     "outlettype": [
      ""
     ]
    }
   },
   {
    "box": {
     "id": "obj-26",
     "maxclass": "live.numbox",
     "numinlets": 1,
     "numoutlets": 2,
     "patching_rect": [
      1320,
      880,
      100,
      18
     ],
     "outlettype": [
      "",
      "float"
     ],
     "parameter_enable": 1,
     "saved_attribute_attributes": {
      "valueof": {
       "parameter_longname": "Semilla",
       "parameter_shortname": "Semilla",
       "parameter_type": 0,
       "parameter_mmin": 1,
       "parameter_mmax": 9999,
       "parameter_initial_enable": 1,
       "parameter_initial": [
        1
       ],
       "parameter_unitstyle": 0,
       "parameter_exponent": 1
      }
     }
    }
   },
   {
    "box": {
     "id": "obj-27",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 1,
     "patching_rect": [
      1320,
      920,
      110,
      22
     ],
     "text": "prepend seed",
     "outlettype": [
      ""
     ]
    }
   },
   {
    "box": {
     "id": "obj-28",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 2,
     "patching_rect": [
      1200,
      600,
      120,
      22
     ],
     "text": "p sv_rs_panel",
     "outlettype": [
      "",
      ""
     ],
     "patcher": {
      "fileversion": 1,
      "appversion": {
       "major": 9,
       "minor": 1,
       "revision": 5,
       "architecture": "x64",
       "modernui": 1
      },
      "classnamespace": "box",
      "rect": [
       120,
       120,
       1000,
       700
      ],
      "openinpresentation": 1,
      "default_fontsize": 10,
      "default_fontname": "Arial",
      "gridsize": [
       8,
       8
      ],
      "boxes": [
       {
        "box": {
         "id": "obj-1",
         "maxclass": "inlet",
         "numinlets": 0,
         "numoutlets": 1,
         "patching_rect": [
          20,
          20,
          40,
          22
         ],
         "outlettype": [
          ""
         ],
         "index": 1,
         "comment": "mensajes del motor y pcontrol"
        }
       },
       {
        "box": {
         "id": "obj-2",
         "maxclass": "v8ui",
         "numinlets": 1,
         "numoutlets": 1,
         "patching_rect": [
          20,
          80,
          1000,
          640
         ],
         "outlettype": [
          ""
         ],
         "presentation": 1,
         "presentation_rect": [
          0,
          0,
          1000,
          640
         ],
         "filename": "sv_rs_ui.js",
         "jsarguments": [
          "panel"
         ],
         "parameter_enable": 0,
         "textfile": {
          "filename": "sv_rs_ui.js",
          "flags": 0,
          "embed": 0,
          "autowatch": 1
         }
        }
       },
       {
        "box": {
         "id": "obj-3",
         "maxclass": "outlet",
         "numinlets": 1,
         "numoutlets": 0,
         "patching_rect": [
          20,
          760,
          40,
          22
         ],
         "index": 1,
         "comment": "acciones de la interfaz"
        }
       },
       {
        "box": {
         "id": "obj-4",
         "maxclass": "textedit",
         "numinlets": 1,
         "numoutlets": 4,
         "patching_rect": [
          1100,
          80,
          180,
          22
         ],
         "outlettype": [
          "",
          "int",
          "",
          ""
         ],
         "presentation": 1,
         "presentation_rect": [
          700,
          9,
          180,
          22
         ],
         "outputmode": 1,
         "keymode": 1,
         "tabmode": 0,
         "bangmode": 0,
         "fontname": "Ableton Sans Medium",
         "fontsize": 11,
         "bgcolor": [
          0.13725490196078433,
          0.14901960784313725,
          0.17647058823529413,
          1
         ],
         "textcolor": [
          0.9254901960784314,
          0.9294117647058824,
          0.9411764705882353,
          1
         ],
         "bordercolor": [
          0.22745098039215686,
          0.24705882352941178,
          0.28627450980392155,
          1
         ],
         "rounded": 3,
         "text": ""
        }
       },
       {
        "box": {
         "id": "obj-5",
         "maxclass": "newobj",
         "numinlets": 2,
         "numoutlets": 2,
         "patching_rect": [
          1100,
          130,
          82,
          22
         ],
         "text": "route text",
         "outlettype": [
          "",
          ""
         ]
        }
       },
       {
        "box": {
         "id": "obj-6",
         "maxclass": "newobj",
         "numinlets": 1,
         "numoutlets": 1,
         "patching_rect": [
          1100,
          170,
          110,
          22
         ],
         "text": "prepend search",
         "outlettype": [
          ""
         ]
        }
       },
       {
        "box": {
         "id": "obj-7",
         "maxclass": "newobj",
         "numinlets": 0,
         "numoutlets": 4,
         "patching_rect": [
          1100,
          230,
          40,
          22
         ],
         "text": "key",
         "outlettype": [
          "int",
          "int",
          "int",
          "int"
         ]
        }
       },
       {
        "box": {
         "id": "obj-8",
         "maxclass": "newobj",
         "numinlets": 1,
         "numoutlets": 1,
         "patching_rect": [
          1100,
          270,
          89,
          22
         ],
         "text": "prepend key",
         "outlettype": [
          ""
         ]
        }
       },
       {
        "box": {
         "id": "obj-9",
         "maxclass": "panel",
         "numinlets": 1,
         "numoutlets": 0,
         "patching_rect": [
          0,
          0,
          1000,
          60
         ],
         "presentation": 1,
         "presentation_rect": [
          0,
          640,
          1000,
          60
         ],
         "bgcolor": [
          0.0784313725490196,
          0.08235294117647059,
          0.09803921568627451,
          1
         ],
         "mode": 0,
         "background": 1
        }
       },
       {
        "box": {
         "id": "obj-10",
         "maxclass": "comment",
         "numinlets": 1,
         "numoutlets": 0,
         "patching_rect": [
          1300,
          20,
          60,
          14
         ],
         "text": "Forma",
         "presentation": 1,
         "presentation_rect": [
          12,
          644,
          60,
          14
         ],
         "fontsize": 10,
         "textcolor": [
          0.5607843137254902,
          0.8392156862745098,
          0.9176470588235294,
          1
         ]
        }
       },
       {
        "box": {
         "id": "obj-11",
         "maxclass": "outlet",
         "numinlets": 1,
         "numoutlets": 0,
         "patching_rect": [
          1300,
          760,
          40,
          22
         ],
         "index": 2,
         "comment": "controles de forma → motor"
        }
       },
       {
        "box": {
         "id": "obj-12",
         "maxclass": "live.dial",
         "numinlets": 1,
         "numoutlets": 2,
         "patching_rect": [
          1300,
          80,
          44,
          48
         ],
         "outlettype": [
          "",
          "float"
         ],
         "presentation": 1,
         "presentation_rect": [
          80,
          646,
          44,
          48
         ],
         "parameter_enable": 1,
         "saved_attribute_attributes": {
          "valueof": {
           "parameter_longname": "Densidad",
           "parameter_shortname": "Densidad",
           "parameter_type": 1,
           "parameter_mmin": -100,
           "parameter_mmax": 100,
           "parameter_initial_enable": 1,
           "parameter_initial": [
            0
           ],
           "parameter_unitstyle": 0
          }
         }
        }
       },
       {
        "box": {
         "id": "obj-13",
         "maxclass": "newobj",
         "numinlets": 1,
         "numoutlets": 1,
         "patching_rect": [
          1300,
          130,
          150,
          22
         ],
         "text": "prepend form densidad",
         "outlettype": [
          ""
         ]
        }
       },
       {
        "box": {
         "id": "obj-14",
         "maxclass": "live.dial",
         "numinlets": 1,
         "numoutlets": 2,
         "patching_rect": [
          1390,
          80,
          44,
          48
         ],
         "outlettype": [
          "",
          "float"
         ],
         "presentation": 1,
         "presentation_rect": [
          144,
          646,
          44,
          48
         ],
         "parameter_enable": 1,
         "saved_attribute_attributes": {
          "valueof": {
           "parameter_longname": "Síncopa",
           "parameter_shortname": "Síncopa",
           "parameter_type": 1,
           "parameter_mmin": 0,
           "parameter_mmax": 100,
           "parameter_initial_enable": 1,
           "parameter_initial": [
            0
           ],
           "parameter_unitstyle": 0
          }
         }
        }
       },
       {
        "box": {
         "id": "obj-15",
         "maxclass": "newobj",
         "numinlets": 1,
         "numoutlets": 1,
         "patching_rect": [
          1390,
          130,
          150,
          22
         ],
         "text": "prepend form sincopa",
         "outlettype": [
          ""
         ]
        }
       },
       {
        "box": {
         "id": "obj-16",
         "maxclass": "comment",
         "numinlets": 1,
         "numoutlets": 0,
         "patching_rect": [
          1480,
          60,
          100,
          14
         ],
         "text": "Microtiempo",
         "presentation": 1,
         "presentation_rect": [
          208,
          648,
          100,
          14
         ],
         "fontsize": 9,
         "textcolor": [
          0.6627450980392157,
          0.6784313725490196,
          0.7176470588235294,
          1
         ]
        }
       },
       {
        "box": {
         "id": "obj-17",
         "maxclass": "live.menu",
         "numinlets": 1,
         "numoutlets": 3,
         "patching_rect": [
          1480,
          80,
          100,
          16
         ],
         "outlettype": [
          "",
          "",
          "float"
         ],
         "presentation": 1,
         "presentation_rect": [
          208,
          666,
          100,
          16
         ],
         "parameter_enable": 1,
         "saved_attribute_attributes": {
          "valueof": {
           "parameter_longname": "Microtiempo",
           "parameter_shortname": "Micro",
           "parameter_type": 2,
           "parameter_enum": [
            "Recto",
            "Swing 62 %",
            "Samba",
            "Telespringar",
            "Laid-back",
            "Push"
           ],
           "parameter_mmax": 5,
           "parameter_initial_enable": 1,
           "parameter_initial": [
            1
           ]
          }
         }
        }
       },
       {
        "box": {
         "id": "obj-18",
         "maxclass": "newobj",
         "numinlets": 1,
         "numoutlets": 1,
         "patching_rect": [
          1480,
          130,
          150,
          22
         ],
         "text": "prepend form microtiempo",
         "outlettype": [
          ""
         ]
        }
       },
       {
        "box": {
         "id": "obj-19",
         "maxclass": "live.dial",
         "numinlets": 1,
         "numoutlets": 2,
         "patching_rect": [
          1570,
          80,
          44,
          48
         ],
         "outlettype": [
          "",
          "float"
         ],
         "presentation": 1,
         "presentation_rect": [
          324,
          646,
          44,
          48
         ],
         "parameter_enable": 1,
         "saved_attribute_attributes": {
          "valueof": {
           "parameter_longname": "Humanizar",
           "parameter_shortname": "Human",
           "parameter_type": 1,
           "parameter_mmin": 0,
           "parameter_mmax": 30,
           "parameter_initial_enable": 1,
           "parameter_initial": [
            0
           ],
           "parameter_unitstyle": 0
          }
         }
        }
       },
       {
        "box": {
         "id": "obj-20",
         "maxclass": "newobj",
         "numinlets": 1,
         "numoutlets": 1,
         "patching_rect": [
          1570,
          130,
          150,
          22
         ],
         "text": "prepend form humanizar",
         "outlettype": [
          ""
         ]
        }
       },
       {
        "box": {
         "id": "obj-21",
         "maxclass": "live.dial",
         "numinlets": 1,
         "numoutlets": 2,
         "patching_rect": [
          1660,
          80,
          44,
          48
         ],
         "outlettype": [
          "",
          "float"
         ],
         "presentation": 1,
         "presentation_rect": [
          388,
          646,
          44,
          48
         ],
         "parameter_enable": 1,
         "saved_attribute_attributes": {
          "valueof": {
           "parameter_longname": "Velocity mínima",
           "parameter_shortname": "Vel min",
           "parameter_type": 1,
           "parameter_mmin": 1,
           "parameter_mmax": 127,
           "parameter_initial_enable": 1,
           "parameter_initial": [
            1
           ],
           "parameter_unitstyle": 0
          }
         }
        }
       },
       {
        "box": {
         "id": "obj-22",
         "maxclass": "newobj",
         "numinlets": 1,
         "numoutlets": 1,
         "patching_rect": [
          1660,
          130,
          150,
          22
         ],
         "text": "prepend form vel_min",
         "outlettype": [
          ""
         ]
        }
       },
       {
        "box": {
         "id": "obj-23",
         "maxclass": "live.dial",
         "numinlets": 1,
         "numoutlets": 2,
         "patching_rect": [
          1750,
          80,
          44,
          48
         ],
         "outlettype": [
          "",
          "float"
         ],
         "presentation": 1,
         "presentation_rect": [
          452,
          646,
          44,
          48
         ],
         "parameter_enable": 1,
         "saved_attribute_attributes": {
          "valueof": {
           "parameter_longname": "Velocity máxima",
           "parameter_shortname": "Vel max",
           "parameter_type": 1,
           "parameter_mmin": 1,
           "parameter_mmax": 127,
           "parameter_initial_enable": 1,
           "parameter_initial": [
            127
           ],
           "parameter_unitstyle": 0
          }
         }
        }
       },
       {
        "box": {
         "id": "obj-24",
         "maxclass": "newobj",
         "numinlets": 1,
         "numoutlets": 1,
         "patching_rect": [
          1750,
          130,
          150,
          22
         ],
         "text": "prepend form vel_max",
         "outlettype": [
          ""
         ]
        }
       },
       {
        "box": {
         "id": "obj-25",
         "maxclass": "live.dial",
         "numinlets": 1,
         "numoutlets": 2,
         "patching_rect": [
          1840,
          80,
          44,
          48
         ],
         "outlettype": [
          "",
          "float"
         ],
         "presentation": 1,
         "presentation_rect": [
          516,
          646,
          44,
          48
         ],
         "parameter_enable": 1,
         "saved_attribute_attributes": {
          "valueof": {
           "parameter_longname": "Complementariedad",
           "parameter_shortname": "Adapt",
           "parameter_type": 1,
           "parameter_mmin": 0,
           "parameter_mmax": 100,
           "parameter_initial_enable": 1,
           "parameter_initial": [
            50
           ],
           "parameter_unitstyle": 0
          }
         }
        }
       },
       {
        "box": {
         "id": "obj-26",
         "maxclass": "newobj",
         "numinlets": 1,
         "numoutlets": 1,
         "patching_rect": [
          1840,
          130,
          150,
          22
         ],
         "text": "prepend form adaptable",
         "outlettype": [
          ""
         ]
        }
       },
       {
        "box": {
         "id": "obj-27",
         "maxclass": "comment",
         "numinlets": 1,
         "numoutlets": 0,
         "patching_rect": [
          1930,
          60,
          100,
          14
         ],
         "text": "Seguir bombo",
         "presentation": 1,
         "presentation_rect": [
          580,
          648,
          100,
          14
         ],
         "fontsize": 9,
         "textcolor": [
          0.6627450980392157,
          0.6784313725490196,
          0.7176470588235294,
          1
         ]
        }
       },
       {
        "box": {
         "id": "obj-28",
         "maxclass": "live.menu",
         "numinlets": 1,
         "numoutlets": 3,
         "patching_rect": [
          1930,
          80,
          100,
          16
         ],
         "outlettype": [
          "",
          "",
          "float"
         ],
         "presentation": 1,
         "presentation_rect": [
          580,
          666,
          100,
          16
         ],
         "parameter_enable": 1,
         "saved_attribute_attributes": {
          "valueof": {
           "parameter_longname": "Seguir bombo",
           "parameter_shortname": "Bombo",
           "parameter_type": 2,
           "parameter_enum": [
            "Auto",
            "Sí",
            "No"
           ],
           "parameter_mmax": 2,
           "parameter_initial_enable": 1,
           "parameter_initial": [
            0
           ]
          }
         }
        }
       },
       {
        "box": {
         "id": "obj-29",
         "maxclass": "newobj",
         "numinlets": 1,
         "numoutlets": 1,
         "patching_rect": [
          1930,
          130,
          150,
          22
         ],
         "text": "prepend form seguir_bombo",
         "outlettype": [
          ""
         ]
        }
       }
      ],
      "lines": [
       {
        "patchline": {
         "source": [
          "obj-1",
          0
         ],
         "destination": [
          "obj-2",
          0
         ]
        }
       },
       {
        "patchline": {
         "source": [
          "obj-2",
          0
         ],
         "destination": [
          "obj-3",
          0
         ]
        }
       },
       {
        "patchline": {
         "source": [
          "obj-4",
          0
         ],
         "destination": [
          "obj-5",
          0
         ]
        }
       },
       {
        "patchline": {
         "source": [
          "obj-5",
          0
         ],
         "destination": [
          "obj-6",
          0
         ]
        }
       },
       {
        "patchline": {
         "source": [
          "obj-6",
          0
         ],
         "destination": [
          "obj-2",
          0
         ]
        }
       },
       {
        "patchline": {
         "source": [
          "obj-7",
          0
         ],
         "destination": [
          "obj-8",
          0
         ]
        }
       },
       {
        "patchline": {
         "source": [
          "obj-8",
          0
         ],
         "destination": [
          "obj-2",
          0
         ]
        }
       },
       {
        "patchline": {
         "source": [
          "obj-12",
          0
         ],
         "destination": [
          "obj-13",
          0
         ]
        }
       },
       {
        "patchline": {
         "source": [
          "obj-13",
          0
         ],
         "destination": [
          "obj-11",
          0
         ]
        }
       },
       {
        "patchline": {
         "source": [
          "obj-14",
          0
         ],
         "destination": [
          "obj-15",
          0
         ]
        }
       },
       {
        "patchline": {
         "source": [
          "obj-15",
          0
         ],
         "destination": [
          "obj-11",
          0
         ]
        }
       },
       {
        "patchline": {
         "source": [
          "obj-17",
          0
         ],
         "destination": [
          "obj-18",
          0
         ]
        }
       },
       {
        "patchline": {
         "source": [
          "obj-18",
          0
         ],
         "destination": [
          "obj-11",
          0
         ]
        }
       },
       {
        "patchline": {
         "source": [
          "obj-19",
          0
         ],
         "destination": [
          "obj-20",
          0
         ]
        }
       },
       {
        "patchline": {
         "source": [
          "obj-20",
          0
         ],
         "destination": [
          "obj-11",
          0
         ]
        }
       },
       {
        "patchline": {
         "source": [
          "obj-21",
          0
         ],
         "destination": [
          "obj-22",
          0
         ]
        }
       },
       {
        "patchline": {
         "source": [
          "obj-22",
          0
         ],
         "destination": [
          "obj-11",
          0
         ]
        }
       },
       {
        "patchline": {
         "source": [
          "obj-23",
          0
         ],
         "destination": [
          "obj-24",
          0
         ]
        }
       },
       {
        "patchline": {
         "source": [
          "obj-24",
          0
         ],
         "destination": [
          "obj-11",
          0
         ]
        }
       },
       {
        "patchline": {
         "source": [
          "obj-25",
          0
         ],
         "destination": [
          "obj-26",
          0
         ]
        }
       },
       {
        "patchline": {
         "source": [
          "obj-26",
          0
         ],
         "destination": [
          "obj-11",
          0
         ]
        }
       },
       {
        "patchline": {
         "source": [
          "obj-28",
          0
         ],
         "destination": [
          "obj-29",
          0
         ]
        }
       },
       {
        "patchline": {
         "source": [
          "obj-29",
          0
         ],
         "destination": [
          "obj-11",
          0
         ]
        }
       }
      ],
      "dependency_cache": [],
      "autosave": 0,
      "toolbarvisible": 0,
      "statusbarvisible": 0,
      "enablehscroll": 0,
      "enablevscroll": 0,
      "title": "SV Ritmic Sequencer · Navegador de ritmos"
     }
    }
   },
   {
    "box": {
     "id": "obj-29",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 1,
     "patching_rect": [
      1200,
      560,
      68,
      22
     ],
     "text": "pcontrol",
     "outlettype": [
      ""
     ]
    }
   },
   {
    "box": {
     "id": "obj-30",
     "maxclass": "message",
     "numinlets": 2,
     "numoutlets": 1,
     "patching_rect": [
      1200,
      520,
      40,
      22
     ],
     "text": "open",
     "outlettype": [
      ""
     ]
    }
   }
  ],
  "lines": [
   {
    "patchline": {
     "source": [
      "obj-1",
      0
     ],
     "destination": [
      "obj-2",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-4",
      0
     ],
     "destination": [
      "obj-5",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-5",
      0
     ],
     "destination": [
      "obj-6",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-6",
      1
     ],
     "destination": [
      "obj-8",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-8",
      0
     ],
     "destination": [
      "obj-3",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-6",
      0
     ],
     "destination": [
      "obj-7",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-7",
      0
     ],
     "destination": [
      "obj-3",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-3",
      3
     ],
     "destination": [
      "obj-10",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-10",
      0
     ],
     "destination": [
      "obj-2",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-3",
      0
     ],
     "destination": [
      "obj-11",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-3",
      1
     ],
     "destination": [
      "obj-12",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-12",
      0
     ],
     "destination": [
      "obj-11",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-11",
      0
     ],
     "destination": [
      "obj-13",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-13",
      0
     ],
     "destination": [
      "obj-14",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-14",
      0
     ],
     "destination": [
      "obj-15",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-15",
      0
     ],
     "destination": [
      "obj-3",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-13",
      1
     ],
     "destination": [
      "obj-16",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-16",
      0
     ],
     "destination": [
      "obj-17",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-17",
      0
     ],
     "destination": [
      "obj-3",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-13",
      2
     ],
     "destination": [
      "obj-18",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-18",
      0
     ],
     "destination": [
      "obj-19",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-19",
      0
     ],
     "destination": [
      "obj-3",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-13",
      3
     ],
     "destination": [
      "obj-20",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-20",
      0
     ],
     "destination": [
      "obj-21",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-21",
      0
     ],
     "destination": [
      "obj-3",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-13",
      4
     ],
     "destination": [
      "obj-22",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-22",
      0
     ],
     "destination": [
      "obj-23",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-23",
      0
     ],
     "destination": [
      "obj-3",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-13",
      5
     ],
     "destination": [
      "obj-24",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-24",
      0
     ],
     "destination": [
      "obj-25",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-25",
      0
     ],
     "destination": [
      "obj-3",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-13",
      6
     ],
     "destination": [
      "obj-26",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-26",
      0
     ],
     "destination": [
      "obj-27",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-27",
      0
     ],
     "destination": [
      "obj-3",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-13",
      8
     ],
     "destination": [
      "obj-3",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-3",
      4
     ],
     "destination": [
      "obj-13",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-13",
      7
     ],
     "destination": [
      "obj-30",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-30",
      0
     ],
     "destination": [
      "obj-29",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-29",
      0
     ],
     "destination": [
      "obj-28",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-3",
      0
     ],
     "destination": [
      "obj-28",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-12",
      0
     ],
     "destination": [
      "obj-28",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-28",
      0
     ],
     "destination": [
      "obj-13",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-28",
      1
     ],
     "destination": [
      "obj-3",
      0
     ]
    }
   }
  ],
  "dependency_cache": [],
  "autosave": 0,
  "devicewidth": 860
 }
}