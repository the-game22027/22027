"""Writes the hand-written development bundle (docs/architecture/07 §5.4) to data/bundles/<BUNDLE_VERSION>/.

Run from the repository root: python3 -I data/generate/dev_bundle.py
Every change to the questions or the review flags needs a new BUNDLE_VERSION: the app refuses
a used version with different content.
"""

import hashlib
import json
from pathlib import Path

BUNDLE_VERSION = "dev-0001"
# Set a locale to True only after a person checked every question in it (facts and wording).
HUMAN_REVIEWED = {"en": False, "ar": False}

N = {  # entity names: en, ar
    "uruguay": ("Uruguay", "أوروغواي"),
    "argentina": ("Argentina", "الأرجنتين"),
    "brazil": ("Brazil", "البرازيل"),
    "italy": ("Italy", "إيطاليا"),
    "france": ("France", "فرنسا"),
    "germany": ("Germany", "ألمانيا"),
    "west_germany": ("West Germany", "ألمانيا الغربية"),
    "england": ("England", "إنجلترا"),
    "spain": ("Spain", "إسبانيا"),
    "netherlands": ("Netherlands", "هولندا"),
    "croatia": ("Croatia", "كرواتيا"),
    "morocco": ("Morocco", "المغرب"),
    "belgium": ("Belgium", "بلجيكا"),
    "portugal": ("Portugal", "البرتغال"),
    "turkey": ("Turkey", "تركيا"),
    "south_korea": ("South Korea", "كوريا الجنوبية"),
    "soviet_union": ("Soviet Union", "الاتحاد السوفيتي"),
    "qatar": ("Qatar", "قطر"),
    "uae": ("United Arab Emirates", "الإمارات"),
    "saudi_arabia": ("Saudi Arabia", "السعودية"),
    "russia": ("Russia", "روسيا"),
    "colombia": ("Colombia", "كولومبيا"),
    "mexico": ("Mexico", "المكسيك"),
    "south_africa": ("South Africa", "جنوب أفريقيا"),
    "egypt": ("Egypt", "مصر"),
    "nigeria": ("Nigeria", "نيجيريا"),
    "usa": ("United States", "الولايات المتحدة"),
    "canada": ("Canada", "كندا"),
    "china": ("China", "الصين"),
    "australia": ("Australia", "أستراليا"),
    "indonesia": ("Indonesia", "إندونيسيا"),
    "greece": ("Greece", "اليونان"),
    "czech_republic": ("Czech Republic", "التشيك"),
    "denmark": ("Denmark", "الدنمارك"),
    "sweden": ("Sweden", "السويد"),
    "wales": ("Wales", "ويلز"),
    "liverpool": ("Liverpool", "ليفربول"),
    "milan": ("AC Milan", "ميلان"),
    "chelsea": ("Chelsea", "تشيلسي"),
    "juventus": ("Juventus", "يوفنتوس"),
    "man_utd": ("Manchester United", "مانشستر يونايتد"),
    "bayern": ("Bayern Munich", "بايرن ميونخ"),
    "barcelona": ("Barcelona", "برشلونة"),
    "porto": ("Porto", "بورتو"),
    "monaco": ("Monaco", "موناكو"),
    "deportivo": ("Deportivo La Coruña", "ديبورتيفو لاكورونيا"),
    "marseille": ("Marseille", "مرسيليا"),
    "ajax": ("Ajax", "أياكس"),
    "inter": ("Inter Milan", "إنتر ميلان"),
    "lyon": ("Lyon", "ليون"),
    "dortmund": ("Borussia Dortmund", "بوروسيا دورتموند"),
    "schalke": ("Schalke 04", "شالكه"),
    "leverkusen": ("Bayer Leverkusen", "باير ليفركوزن"),
    "bremen": ("Werder Bremen", "فيردر بريمن"),
    "man_city": ("Manchester City", "مانشستر سيتي"),
    "real_madrid": ("Real Madrid", "ريال مدريد"),
    "tottenham": ("Tottenham Hotspur", "توتنهام هوتسبير"),
    "arsenal": ("Arsenal", "آرسنال"),
    "reims": ("Reims", "ريمس"),
    "benfica": ("Benfica", "بنفيكا"),
    "iniesta": ("Andrés Iniesta", "أندريس إنييستا"),
    "villa": ("David Villa", "دافيد فيا"),
    "torres": ("Fernando Torres", "فرناندو توريس"),
    "xavi": ("Xavi", "تشافي"),
    "gotze": ("Mario Götze", "ماريو غوتزه"),
    "muller": ("Thomas Müller", "توماس مولر"),
    "klose": ("Miroslav Klose", "ميروسلاف كلوزه"),
    "schurrle": ("André Schürrle", "أندريه شورله"),
    "zidane": ("Zinedine Zidane", "زين الدين زيدان"),
    "materazzi": ("Marco Materazzi", "ماركو ماتيراتزي"),
    "henry": ("Thierry Henry", "تييري هنري"),
    "cannavaro": ("Fabio Cannavaro", "فابيو كانافارو"),
    "buffon": ("Gianluigi Buffon", "جانلويجي بوفون"),
    "modric": ("Luka Modrić", "لوكا مودريتش"),
    "ronaldo": ("Cristiano Ronaldo", "كريستيانو رونالدو"),
    "messi": ("Lionel Messi", "ليونيل ميسي"),
    "griezmann": ("Antoine Griezmann", "أنطوان غريزمان"),
    "benzema": ("Karim Benzema", "كريم بنزيمة"),
    "mane": ("Sadio Mané", "ساديو ماني"),
    "de_bruyne": ("Kevin De Bruyne", "كيفن دي بروين"),
    "lewandowski": ("Robert Lewandowski", "روبرت ليفاندوفسكي"),
    "kaka": ("Kaká", "كاكا"),
    "ronaldinho": ("Ronaldinho", "رونالدينيو"),
    "rodri": ("Rodri", "رودري"),
    "vinicius": ("Vinícius Júnior", "فينيسيوس جونيور"),
    "bellingham": ("Jude Bellingham", "جود بيلينغهام"),
    "haaland": ("Erling Haaland", "إرلينغ هالاند"),
    "weah": ("George Weah", "جورج وايا"),
    "klinsmann": ("Jürgen Klinsmann", "يورغن كلينسمان"),
    "maldini": ("Paolo Maldini", "باولو مالديني"),
    "baggio": ("Roberto Baggio", "روبرتو باجيو"),
    "shevchenko": ("Andriy Shevchenko", "أندريه شيفتشينكو"),
    "deco": ("Deco", "ديكو"),
    "maracana": ("Maracanã", "ملعب ماراكانا"),
    "centenario": ("Estadio Centenario", "ملعب سنتيناريو"),
    "wembley": ("Wembley Stadium", "ملعب ويمبلي"),
    "azteca": ("Estadio Azteca", "ملعب أزتيكا"),
    "lusail": ("Lusail", "لوسيل"),
    "doha": ("Doha", "الدوحة"),
    "al_rayyan": ("Al Rayyan", "الريان"),
    "al_khor": ("Al Khor", "الخور"),
}

WC_SOURCES = (["hand-written", "openfootball/worldcup"], ["CC0-1.0"])
HAND = (["hand-written"], [])

# (key, category, difficulty, en, ar, [correct, wrong, wrong, wrong], explanation_en, explanation_ar, sources)
Q = []
wc_winners = [
    (
        2022,
        "argentina",
        ["france", "croatia", "morocco"],
        1,
        "Argentina beat France on penalties after a 3-3 draw in Lusail.",
        "فازت الأرجنتين على فرنسا بركلات الترجيح بعد التعادل 3-3 في لوسيل.",
    ),
    (
        2018,
        "france",
        ["croatia", "belgium", "england"],
        1,
        "France beat Croatia 4-2 in the final in Moscow.",
        "فازت فرنسا على كرواتيا 4-2 في النهائي في موسكو.",
    ),
    (
        2014,
        "germany",
        ["argentina", "netherlands", "brazil"],
        1,
        "Germany beat Argentina 1-0 after extra time at the Maracanã.",
        "فازت ألمانيا على الأرجنتين 1-0 بعد الوقت الإضافي في ملعب ماراكانا.",
    ),
    (
        2010,
        "spain",
        ["netherlands", "germany", "uruguay"],
        1,
        "Spain beat the Netherlands 1-0 after extra time.",
        "فازت إسبانيا على هولندا 1-0 بعد الوقت الإضافي.",
    ),
    (
        2006,
        "italy",
        ["france", "germany", "portugal"],
        2,
        "Italy beat France 5-3 on penalties after a 1-1 draw in Berlin.",
        "فازت إيطاليا على فرنسا 5-3 بركلات الترجيح بعد التعادل 1-1 في برلين.",
    ),
    (
        2002,
        "brazil",
        ["germany", "turkey", "south_korea"],
        2,
        "Brazil beat Germany 2-0 in the final in Yokohama.",
        "فازت البرازيل على ألمانيا 2-0 في النهائي في يوكوهاما.",
    ),
    (
        1998,
        "france",
        ["brazil", "croatia", "netherlands"],
        2,
        "Host France beat Brazil 3-0 in the final.",
        "فازت فرنسا المستضيفة على البرازيل 3-0 في النهائي.",
    ),
    (
        1986,
        "argentina",
        ["west_germany", "france", "belgium"],
        3,
        "Argentina beat West Germany 3-2 at the Estadio Azteca.",
        "فازت الأرجنتين على ألمانيا الغربية 3-2 في ملعب أزتيكا.",
    ),
    (
        1966,
        "england",
        ["west_germany", "portugal", "soviet_union"],
        3,
        "Host England beat West Germany 4-2 after extra time at Wembley.",
        "فازت إنجلترا المستضيفة على ألمانيا الغربية 4-2 بعد الوقت الإضافي في ويمبلي.",
    ),
    (
        1930,
        "uruguay",
        ["argentina", "usa", "brazil"],
        3,
        "Host Uruguay won the first World Cup, beating Argentina 4-2 in the final.",
        "فازت أوروغواي المستضيفة بأول كأس عالم بعد فوزها على الأرجنتين 4-2 في النهائي.",
    ),
]
for year, correct, wrong, diff, ex_en, ex_ar in wc_winners:
    Q.append(
        (
            f"dev:wc_winner:{year}",
            "world-cup",
            diff,
            f"Which country won the {year} World Cup?",
            f"أي منتخب فاز بكأس العالم {year}؟",
            [correct, *wrong],
            ex_en,
            ex_ar,
            WC_SOURCES,
        )
    )

wc_hosts = [
    (2022, "qatar", ["uae", "saudi_arabia", "morocco"], 1),
    (2018, "russia", ["england", "spain", "netherlands"], 1),
    (2014, "brazil", ["argentina", "colombia", "mexico"], 1),
    (2010, "south_africa", ["morocco", "egypt", "nigeria"], 2),
    (1994, "usa", ["mexico", "canada", "brazil"], 2),
]
for year, correct, wrong, diff in wc_hosts:
    Q.append(
        (
            f"dev:wc_host:{year}",
            "world-cup",
            diff,
            f"Which country hosted the {year} World Cup?",
            f"أي دولة استضافت كأس العالم {year}؟",
            [correct, *wrong],
            None,
            None,
            WC_SOURCES,
        )
    )
Q.append(
    (
        "dev:wc_cohost:2002",
        "world-cup",
        2,
        "Which country co-hosted the 2002 World Cup with Japan?",
        "أي دولة استضافت كأس العالم 2002 بالاشتراك مع اليابان؟",
        ["south_korea", "china", "australia", "indonesia"],
        None,
        None,
        WC_SOURCES,
    )
)

wc_final_opponents = [
    (
        "dev:wc_final_loser:2010",
        "Spain beat which team in the 2010 World Cup final?",
        "تغلبت إسبانيا على أي منتخب في نهائي كأس العالم 2010؟",
        ["netherlands", "germany", "uruguay", "argentina"],
        2,
    ),
    (
        "dev:wc_final_loser:2018",
        "France beat which team in the 2018 World Cup final?",
        "تغلبت فرنسا على أي منتخب في نهائي كأس العالم 2018؟",
        ["croatia", "belgium", "england", "uruguay"],
        1,
    ),
    (
        "dev:wc_final_loser:2022",
        "Argentina beat which team on penalties in the 2022 World Cup final?",
        "تغلبت الأرجنتين على أي منتخب بركلات الترجيح في نهائي كأس العالم 2022؟",
        ["france", "croatia", "morocco", "netherlands"],
        1,
    ),
    (
        "dev:wc_final_loser:2014",
        "Which team lost the 2014 World Cup final to Germany?",
        "أي منتخب خسر نهائي كأس العالم 2014 أمام ألمانيا؟",
        ["argentina", "netherlands", "brazil", "spain"],
        1,
    ),
]
for key, en, ar, options, diff in wc_final_opponents:
    Q.append((key, "world-cup", diff, en, ar, options, None, None, WC_SOURCES))

Q += [
    (
        "dev:wc_final_winning_goal:2010",
        "world-cup",
        2,
        "Who scored the winning goal in the 2010 World Cup final?",
        "من سجل هدف الفوز في نهائي كأس العالم 2010؟",
        ["iniesta", "villa", "torres", "xavi"],
        "Iniesta scored in the 116th minute against the Netherlands.",
        "سجل إنييستا في الدقيقة 116 أمام هولندا.",
        WC_SOURCES,
    ),
    (
        "dev:wc_final_winning_goal:2014",
        "world-cup",
        2,
        "Who scored the winning goal in the 2014 World Cup final?",
        "من سجل هدف الفوز في نهائي كأس العالم 2014؟",
        ["gotze", "muller", "klose", "schurrle"],
        "Götze scored in the 113th minute against Argentina.",
        "سجل غوتزه في الدقيقة 113 أمام الأرجنتين.",
        WC_SOURCES,
    ),
    (
        "dev:wc_final_red_card:2006",
        "world-cup",
        2,
        "Which player was sent off in the 2006 World Cup final?",
        "أي لاعب طُرد في نهائي كأس العالم 2006؟",
        ["zidane", "materazzi", "henry", "cannavaro"],
        "Zidane was sent off in extra time for headbutting Materazzi.",
        "طُرد زيدان في الوقت الإضافي بعد نطحه ماتيراتزي.",
        HAND,
    ),
    (
        "dev:wc_decider_stadium:1950",
        "world-cup",
        4,
        "Where did Uruguay beat Brazil 2-1 in the deciding match of the 1950 World Cup?",
        "في أي ملعب فازت أوروغواي على البرازيل 2-1 في المباراة الحاسمة لكأس العالم 1950؟",
        ["maracana", "centenario", "wembley", "azteca"],
        None,
        None,
        WC_SOURCES,
    ),
    (
        "dev:wc_final_city:2022",
        "world-cup",
        3,
        "In which city was the 2022 World Cup final played?",
        "في أي مدينة أقيم نهائي كأس العالم 2022؟",
        ["lusail", "doha", "al_rayyan", "al_khor"],
        None,
        None,
        WC_SOURCES,
    ),
]

euros = [
    (
        "2004",
        "greece",
        ["portugal", "czech_republic", "netherlands"],
        2,
        "Greece beat host Portugal 1-0 in the final.",
        "فازت اليونان على البرتغال المستضيفة 1-0 في النهائي.",
    ),
    (
        "1992",
        "denmark",
        ["germany", "sweden", "netherlands"],
        3,
        "Denmark joined late as a replacement team and won it.",
        "شاركت الدنمارك متأخرة كبديل وفازت باللقب.",
    ),
    ("2016", "portugal", ["france", "wales", "germany"], 1, None, None),
    ("2008", "spain", ["germany", "russia", "turkey"], 2, None, None),
    ("1988", "netherlands", ["soviet_union", "west_germany", "italy"], 3, None, None),
    (
        "2024",
        "spain",
        ["england", "france", "netherlands"],
        1,
        "Spain beat England 2-1 in the final in Berlin.",
        "فازت إسبانيا على إنجلترا 2-1 في النهائي في برلين.",
    ),
]
for year, correct, wrong, diff, ex_en, ex_ar in euros:
    Q.append(
        (
            f"dev:euro_winner:{year}",
            "euros",
            diff,
            f"Which country won Euro {year}?",
            f"أي منتخب فاز ببطولة أمم أوروبا {year}؟",
            [correct, *wrong],
            ex_en,
            ex_ar,
            HAND,
        )
    )
Q += [
    (
        "dev:euro_winner:2020",
        "euros",
        1,
        "Which country won Euro 2020, played in 2021?",
        "أي منتخب فاز ببطولة أمم أوروبا 2020 التي أقيمت عام 2021؟",
        ["italy", "england", "spain", "denmark"],
        "Italy beat England on penalties at Wembley.",
        "فازت إيطاليا على إنجلترا بركلات الترجيح في ويمبلي.",
        HAND,
    ),
    (
        "dev:euro_final_loser:2016",
        "euros",
        2,
        "Portugal beat which host nation in the Euro 2016 final?",
        "تغلبت البرتغال على أي دولة مستضيفة في نهائي بطولة أمم أوروبا 2016؟",
        ["france", "germany", "wales", "belgium"],
        None,
        None,
        HAND,
    ),
]

cl_winners = [
    (
        "2005",
        "liverpool",
        ["milan", "chelsea", "juventus"],
        1,
        "Liverpool came back from 3-0 down against Milan and won on penalties in Istanbul.",
        "عاد ليفربول من تأخره 3-0 أمام ميلان وفاز بركلات الترجيح في إسطنبول.",
    ),
    (
        "1999",
        "man_utd",
        ["bayern", "juventus", "barcelona"],
        2,
        "United scored twice in stoppage time to beat Bayern 2-1.",
        "سجل يونايتد هدفين في الوقت بدل الضائع وفاز على بايرن 2-1.",
    ),
    (
        "2004",
        "porto",
        ["monaco", "deportivo", "chelsea"],
        3,
        "Porto beat Monaco 3-0 in the final.",
        "فاز بورتو على موناكو 3-0 في النهائي.",
    ),
    (
        "1993",
        "marseille",
        ["milan", "barcelona", "ajax"],
        4,
        "Marseille beat Milan 1-0 in the first Champions League final.",
        "فاز مرسيليا على ميلان 1-0 في أول نهائي لدوري أبطال أوروبا بشكله الجديد.",
    ),
    (
        "2010",
        "inter",
        ["bayern", "barcelona", "lyon"],
        2,
        "Inter beat Bayern 2-0 in Madrid.",
        "فاز إنتر على بايرن 2-0 في مدريد.",
    ),
    (
        "2023",
        "man_city",
        ["inter", "real_madrid", "milan"],
        1,
        "City beat Inter 1-0 in Istanbul.",
        "فاز سيتي على إنتر 1-0 في إسطنبول.",
    ),
    (
        "2012",
        "chelsea",
        ["bayern", "barcelona", "real_madrid"],
        1,
        "Chelsea beat Bayern on penalties in Munich.",
        "فاز تشيلسي على بايرن بركلات الترجيح في ميونخ.",
    ),
]
for year, correct, wrong, diff, ex_en, ex_ar in cl_winners:
    Q.append(
        (
            f"dev:cl_winner:{year}",
            "champions-league",
            diff,
            f"Which club won the {year} Champions League final?",
            f"أي نادٍ فاز بنهائي دوري أبطال أوروبا {year}؟",
            [correct, *wrong],
            ex_en,
            ex_ar,
            HAND,
        )
    )
Q += [
    (
        "dev:cl_final_loser:2013",
        "champions-league",
        2,
        "Bayern Munich beat which German club in the 2013 Champions League final?",
        "تغلب بايرن ميونخ على أي نادٍ ألماني في نهائي دوري أبطال أوروبا 2013؟",
        ["dortmund", "schalke", "leverkusen", "bremen"],
        "The final was played at Wembley; Bayern won 2-1.",
        "أقيم النهائي في ويمبلي وفاز بايرن 2-1.",
        HAND,
    ),
    (
        "dev:cl_final_loser:2019",
        "champions-league",
        2,
        "Liverpool beat which club in the 2019 Champions League final?",
        "تغلب ليفربول على أي نادٍ في نهائي دوري أبطال أوروبا 2019؟",
        ["tottenham", "ajax", "barcelona", "arsenal"],
        None,
        None,
        HAND,
    ),
    (
        "dev:ec_first_winner:1956",
        "champions-league",
        3,
        "Which club won the first European Cup, in 1956?",
        "أي نادٍ فاز بأول نسخة من كأس أوروبا للأندية عام 1956؟",
        ["real_madrid", "reims", "milan", "benfica"],
        "Real Madrid beat Reims 4-3 in Paris.",
        "فاز ريال مدريد على ريمس 4-3 في باريس.",
        HAND,
    ),
]

ballon = [
    ("2018", "modric", ["ronaldo", "griezmann", "messi"], 2),
    ("2022", "benzema", ["mane", "de_bruyne", "lewandowski"], 1),
    ("2006", "cannavaro", ["buffon", "henry", "ronaldinho"], 3),
    ("2007", "kaka", ["ronaldo", "messi", "ronaldinho"], 2),
    ("2024", "rodri", ["vinicius", "bellingham", "haaland"], 1),
    ("1995", "weah", ["klinsmann", "maldini", "baggio"], 4),
    ("2004", "shevchenko", ["deco", "ronaldinho", "henry"], 3),
]
for year, correct, wrong, diff in ballon:
    Q.append(
        (
            f"dev:ballon_dor:{year}",
            "ballon-dor",
            diff,
            f"Who won the {year} Ballon d'Or?",
            f"من فاز بالكرة الذهبية {year}؟",
            [correct, *wrong],
            None,
            None,
            HAND,
        )
    )

CATEGORIES = [
    {"slug": "world-cup", "names": {"en": "World Cup", "ar": "كأس العالم"}},
    {"slug": "euros", "names": {"en": "European Championship", "ar": "بطولة أمم أوروبا"}},
    {"slug": "champions-league", "names": {"en": "Champions League", "ar": "دوري أبطال أوروبا"}},
    {"slug": "ballon-dor", "names": {"en": "Ballon d'Or", "ar": "الكرة الذهبية"}},
]


def rotate(options, key):
    """Spread the correct answer over positions 1-4 so the file itself does not teach "always A"."""
    shift = int(hashlib.sha256(key.encode()).hexdigest(), 16) % len(options)
    return options[-shift:] + options[:-shift] if shift else options


lines = []
for key, category, diff, en, ar, options, ex_en, ex_ar, (sources, licenses) in Q:
    correct = options[0]
    ordered = rotate(options, key)
    lines.append(
        {
            "externalKey": key,
            "type": "SINGLE_CHOICE",
            "category": category,
            "difficulty": diff,
            "locales": {"en": {"text": en, "explanation": ex_en}, "ar": {"text": ar, "explanation": ex_ar}},
            "options": [
                {
                    "position": i + 1,
                    "isCorrect": name == correct,
                    "entityRef": None,
                    "locales": {"en": N[name][0], "ar": N[name][1]},
                }
                for i, name in enumerate(ordered)
            ],
            "provenance": {"facts": [], "sources": sources, "licenses": licenses, "kbVersion": "none"},
            "validUntil": None,
            "humanReviewed": HUMAN_REVIEWED,
        }
    )

keys = [line["externalKey"] for line in lines]
assert len(keys) == len(set(keys)), "repeated key"
out = Path(__file__).resolve().parents[1] / "bundles" / BUNDLE_VERSION
out.mkdir(parents=True, exist_ok=True)
body = "".join(json.dumps(line, ensure_ascii=False) + "\n" for line in lines).encode("utf-8")
(out / "questions.jsonl").write_bytes(body)
manifest = {
    "bundleVersion": BUNDLE_VERSION,
    "kbVersion": "none",
    "generatorVersion": "hand-written",
    "questionCount": len(lines),
    "checksum": "sha256:" + hashlib.sha256(body).hexdigest(),
    "categories": CATEGORIES,
}
(out / "manifest.json").write_text(
    json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
)
print(len(lines), "questions")
