"""Zestawienie postów i zdjęć dla zdarzenia (v3.20): alarm w Ukrainie, zdarzenie złożone, incydent morski, post OSINT, dowolne miejsce.
Szuka w śledzonych kanałach Telegrama po nazwach miejsc (ukr., ros., ang., pol. – z odmianami) i po pozycji wyznaczonej przez AI,
w oknie czasu wokół zdarzenia. Opcjonalnie dokłada wyniki z całego Telegrama (konto operatora) i innych źródeł."""
import math, re, time

# obwód (klucz jak w intel.OBLASTS) → rdzenie nazw: miasto obwodowe i obwód we wszystkich pisowniach (dopasowanie po początku słowa)
UA_PLACES = {
    "вінниц": ["вінниц", "винниц", "vinnyts", "vinnits", "winnic"],
    "волин": ["волин", "луцьк", "луцк", "volyn", "lutsk", "wołyń", "łuck"],
    "дніпроп": ["дніпр", "днепр", "dnipr", "dnepr", "dniepr", "kryvyi", "кривий ріг", "кривой рог", "кривор", "kryw", "кам'янськ", "павлоград", "нікопол", "никопол", "nikopol"],
    "донец": ["донець", "донецк", "donets", "donieck", "краматорськ", "краматорск", "kramatorsk", "słowiańsk", "словянськ", "славянск", "sloviansk", "покровськ", "покровск", "pokrovsk", "костянтинівк", "константиновк", "kostiantynivk", "дружківк", "дружковк"],
    "житомир": ["житомир", "zhytomyr", "żytomierz", "бердичів", "бердичев"],
    "закарпат": ["закарпат", "ужгород", "uzhhorod", "zakarpat", "мукачев"],
    "запоріз": ["запоріж", "запорож", "zaporizh", "zaporoż", "енергодар", "энергодар", "enerhodar", "zaporoze"],
    "івано": ["івано-франк", "ивано-франк", "ivano-frank", "iwano-frank", "франківськ"],
    "київська": ["київщин", "киевск", "kyiv oblast", "obwód kijowski", "бровар", "бориспіл", "борисполь", "бучa", "біла церква", "белая церковь", "фастів", "вишгород", "обухів"],
    "кіровогр": ["кропивницьк", "кропивницк", "kropyvnyts", "kropywnyc", "кіровоград", "кировоград"],
    "луган": ["луган", "луганс", "luhansk", "ługańsk", "сєвєродонецьк", "северодонецк", "лисичанськ", "лисичанск"],
    "львів": ["львів", "львов", "lviv", "lwów", "lwow"],
    "миколаїв": ["миколаїв", "миколає", "николаев", "mykolaiv", "mikołajów", "очаків", "очаков"],
    "одес": ["одес", "одесс", "odes", "odess", "ізмаїл", "ізмаїло", "измаил", "izmail", "чорноморськ", "черноморск", "південн"],
    "полтав": ["полтав", "poltav", "połtaw", "кременчук", "кременчуг", "kremenchuk", "миргород"],
    "рівнен": ["рівне", "рівного", "рівному", "рівненщин", "рівненськ", "ровенск", "rivne", "równe"],
    "сум": ["суми ", "сумах", "сумам", "суми,", "суми.", "сумськ", "сумщин", "сумы", "сумск", "sumy", "шостк", "конотоп", "охтирк", "ахтырк"],
    "терноп": ["терноп", "ternop", "tarnop"],
    "харків": ["харків", "харков", "харьков", "kharkiv", "kharkov", "charków", "charkow", "куп'янськ", "купянск", "kupiansk", "ізюм", "изюм", "чугуїв", "чугуев", "лозов"],
    "херсон": ["херсон", "kherson", "chersoń", "cherson", "берислав", "нова каховк", "новая каховк"],
    "хмельниц": ["хмельниц", "khmelnyts", "chmielnic", "старокостянтинів", "староконстантинов", "нетішин"],
    "черкас": ["черкас", "cherkas", "czerkas", "умань", "uman"],
    "чернівец": ["чернівц", "черновц", "chernivts", "czerniowc"],
    "чернігів": ["чернігів", "черніго", "чернигов", "chernihiv", "czernihów", "ніжин", "нежин", "прилук"],
    "м. київ": ["київ", "києв", "киев", "kyiv", "kiev", "kijów", "kijow", "столиц"],
    "київ": ["київ", "києв", "киев", "kyiv", "kiev", "kijów", "kijow", "столиц"],
    "крим": ["крим", "крым", "crimea", "krym", "сімферопол", "симферопол", "джанкой", "феодос", "керч", "kerch"],
    "автономна республіка крим": ["крим", "крым", "crimea", "krym", "сімферопол", "симферопол", "джанкой", "феодос", "керч", "kerch"],
    "ар крим": ["крим", "крым", "crimea", "krym", "сімферопол", "симферопол", "джанкой", "феодос", "керч", "kerch"],
    "севастоп": ["севастоп", "sevastop", "sewastop"],
}
STRIKE_KW = re.compile(r"ракет|балістик|баллистик|крилат|крылат|шахед|шахід|дрон|бпла|бпла|вибух|взрыв|приліт|прилет|удар|атак|уламк|обломк|пожеж|пожар|"
                       r"missile|ballistic|drone|shahed|explosion|blast|strike|attack|debris|fire|rakiet|dron|wybuch|atak|pożar", re.I)

# v3.22: spam z wyszukiwania w całym Telegramie (kanały „towarzyskie”, kasyna, narkotyki dopisują nazwy miast i hashtagi)
SPAM_STRONG = re.compile(r"знакомств|знайомств|интим|інтим|эскорт|ескорт|досуг|дозвілл|проститу|индивидуалк|индивидуалок|шлюх|порн|нюдс|\bню\b|эротик|еротик|"
                         r"onlyfans|онлифанс|онліфанс|18\s*\+|\bxxx\b|nsfw|escort|hookup|nudes?\b|казино|casino|букмекер|ставки на спорт|"
                         r"закладк|\bмеф\b|мефедрон|кокаин|кокаїн|\bweed\b|randk[ai]|towarzysk|roksa", re.I)
SPAM_TITLE = re.compile(r"девушк|дівчат|девочк|girls?\b|красотк|красун|знакомств|знайомств|массаж|масаж|relax|релакс|vip|sexy|секс|hot\b|\b18\b|"
                        r"казино|casino|crypto|крипт|заработ|заробіт", re.I)


def is_spam(text, title=""):
    return bool(SPAM_STRONG.search(text or "") or SPAM_STRONG.search(title or "") or SPAM_TITLE.search(title or ""))


def km(a, b):
    r = math.pi / 180
    x = math.sin((b[0] - a[0]) * r / 2) ** 2 + math.cos(a[0] * r) * math.cos(b[0] * r) * math.sin((b[1] - a[1]) * r / 2) ** 2
    return 12742 * math.asin(min(1, math.sqrt(x)))


def name_rx(names):
    names = [n for n in dict.fromkeys(n.strip().lower() for n in names if n and len(n.strip()) >= 3)]
    if not names:
        return None
    return re.compile(r"(?<![\w'’])(?:" + "|".join(re.escape(n) for n in sorted(names, key=len, reverse=True)) + r")", re.I)


def search_posts(posts, names=(), pos=None, radius=120, t0=None, t1=None, limit=40):
    """Ocena trafności: nazwa miejsca w treści (+3), pozycja z AI w promieniu (+3), słowa o uderzeniu (+1), zdjęcie/film (+1)."""
    now = time.time() * 1000
    t0 = t0 or now - 3 * 3600e3; t1 = t1 or now
    rx = name_rx(names)
    out = []
    for p in posts:
        if not (t0 - 1800e3 <= p["t"] <= t1 + 3 * 3600e3) or p.get("dup"):
            continue
        a = p.get("ai") or {}
        txt = (p.get("text") or "") + " " + (a.get("title") or "") + " " + (a.get("summary") or "") + " " + (a.get("place") or "")
        sc, why = 0, []
        if rx and rx.search(txt):
            sc += 3; why.append("name")
        if pos and a.get("pos") and km(pos, a["pos"]) <= radius:
            sc += 3; why.append("pos")
        if not sc:
            continue
        if STRIKE_KW.search(txt):
            sc += 1
        if p.get("media"):
            sc += 1
        if a.get("keep") is False:
            sc -= 2
        out.append((sc, p, why))
    out.sort(key=lambda x: (-x[0], -x[1]["t"]))
    return out[:limit]
