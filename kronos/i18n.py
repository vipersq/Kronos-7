"""Język systemu (pl / en): ustawiany w oknie OPERATOR, używany w promptach AI i komunikatach serwera."""
LANG = {"v": "pl"}


def set_lang(code):
    LANG["v"] = "en" if code == "en" else "pl"


def en():
    return LANG["v"] == "en"


def L(pl, en_text):
    return en_text if en() else pl


# dopisywane do promptów systemowych, gdy wybrano angielski
AI_EN = ("\n\nJĘZYK / LANGUAGE: write every text field, summary, label, briefing and answer in English (British spelling), "
         "even though these instructions are in Polish. Use English place names (e.g. Kyiv, Hormuz, Red Sea).")
