# ufc_parser.py – версия без расчёта Total Damage (расчёт на сервере)
import requests
from bs4 import BeautifulSoup
import pandas as pd
import yadisk
import os
import tempfile
from datetime import datetime
import re
import time

YA_TOKEN = "y0__xCOz-U8GI3sPSCOyp-2FnBLBQ7drGtOupKGVfu4CpN2qtUs"
EVENTS_LIST_URL = "http://www.ufcstats.com/statistics/events/completed"
FIGHTERS_LIST_URL = "http://www.ufcstats.com/statistics/fighters?char=a&page=all"
RESULTS_FOLDER = "UFC_Bot_Results"
BACKEND_URL = "https://apf-app-backend.onrender.com/api/tournaments/sync"
RECALCULATE_URL = "https://apf-app-backend.onrender.com/api/tournaments"

def clean_stat(val):
    if val in ('View', 'Matchup', ''):
        return '0'
    return val

def parse_event_date(date_text):
    try:
        date_text = date_text.strip()
        parts = date_text.split()
        if len(parts) >= 3:
            month = parts[0]
            day = parts[1].replace(',', '')
            year = parts[2]
            months = {'January':1,'February':2,'March':3,'April':4,'May':5,'June':6,'July':7,'August':8,'September':9,'October':10,'November':11,'December':12}
            if month in months:
                return datetime(int(year), months[month], int(day))
    except: pass
    return None

def get_upcoming_and_last_events():
    print("🔍 Анализирую список турниров...")
    response = requests.get(EVENTS_LIST_URL)
    soup = BeautifulSoup(response.text, 'html.parser')
    events_table = soup.find('table', class_='b-statistics__table-events')
    if not events_table: return None, None
    rows = events_table.find_all('tr')[1:]
    events = []
    for row in rows:
        cols = row.find_all('td')
        if len(cols) >= 1:
            first_col = cols[0]
            link_tag = first_col.find('a')
            if not link_tag: continue
            event_url = link_tag.get('href')
            full_text = first_col.get_text().strip()
            date_pattern = r'(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}'
            date_match = re.search(date_pattern, full_text)
            if date_match:
                date_text = date_match.group(0)
                event_name = full_text[:date_match.start()].strip()
                event_date = parse_event_date(date_text)
                if event_date:
                    events.append({'name': event_name, 'url': event_url, 'date': event_date, 'date_text': date_text})
    events.sort(key=lambda x: x['date'])
    if len(events) >= 2: return events[-2], events[-1]
    elif len(events) == 1: return None, events[-1]
    return None, None

def is_tournament_complete(df):
    if df is None or df.empty: return False
    for _, row in df.iterrows():
        if row.get('W/L', '') not in ['win', 'lose', 'draw']: return False
    return True

def parse_tournament(event_url, fighters_list):
    print(f"\n📋 Парсинг турнира: {event_url}")
    response = requests.get(event_url)
    soup = BeautifulSoup(response.text, 'html.parser')
    event_name = get_event_name(soup)
    print(f"🏆 Название: {event_name}")
    table = soup.find('table')
    if not table: return None, event_name
    rows = table.find_all('tr')[1:]
    all_fighters = []
    for row_index, row in enumerate(rows):
        cols = row.find_all('td')
        if len(cols) < 10: continue
        wl_text = clean_text(cols[0].get_text())
        fighter_text = clean_text(cols[1].get_text())
        kd_text = clean_text(cols[2].get_text())
        str_text = clean_text(cols[3].get_text())
        td_text = clean_text(cols[4].get_text())
        sub_text = clean_text(cols[5].get_text())
        weight = clean_text(cols[6].get_text())
        method = clean_text(cols[7].get_text())
        round_num = clean_text(cols[8].get_text())
        time_str = clean_text(cols[9].get_text())

        wl_parts = wl_text.split() if wl_text else []
        kd_parts = kd_text.split() if kd_text else []
        str_parts = str_text.split() if str_text else []
        td_parts = td_text.split() if td_text else []
        sub_parts = sub_text.split() if sub_text else []

        name1, name2 = extract_fighter_names(fighter_text, fighters_list)
        if not name1 or not name2: continue

        # Определение победителя
        wl1, wl2 = '', ''
        if 'draw' in wl_text.lower():
            wl1, wl2 = 'draw', 'draw'
        elif len(wl_parts) >= 2:
            if 'win' in wl_parts[0].lower() or 'w' == wl_parts[0].lower():
                wl1, wl2 = 'win', 'lose'
            elif 'win' in wl_parts[1].lower() or 'w' == wl_parts[1].lower():
                wl1, wl2 = 'lose', 'win'
        if not wl1 and not wl2:
            first_col = cols[0]
            winner_icon = first_col.find('img', class_='b-flag__img') or first_col.find('i', class_='fa-trophy')
            if winner_icon:
                wl1, wl2 = 'win', 'lose'
            else:
                cell_text = first_col.get_text().strip().lower()
                if 'win' in cell_text: wl1, wl2 = 'win', 'lose'
                elif 'loss' in cell_text or 'lose' in cell_text: wl1, wl2 = 'lose', 'win'

        kd1 = clean_stat(kd_parts[0]) if len(kd_parts) > 0 else "0"
        kd2 = clean_stat(kd_parts[1]) if len(kd_parts) > 1 else "0"
        str1 = clean_stat(str_parts[0]) if len(str_parts) > 0 else "0"
        str2 = clean_stat(str_parts[1]) if len(str_parts) > 1 else "0"
        td1 = clean_stat(td_parts[0]) if len(td_parts) > 0 else "0"
        td2 = clean_stat(td_parts[1]) if len(td_parts) > 1 else "0"
        sub1 = clean_stat(sub_parts[0]) if len(sub_parts) > 0 else "0"
        sub2 = clean_stat(sub_parts[1]) if len(sub_parts) > 1 else "0"

        head_strikes = {"fighter1": "0", "fighter2": "0"}
        body_strikes = {"fighter1": "0", "fighter2": "0"}
        leg_strikes = {"fighter1": "0", "fighter2": "0"}
        fight_detail_link = None
        onclick_attr = row.get('onclick')
        if onclick_attr and 'fight-details' in onclick_attr:
            match = re.search(r"'(http://www.ufcstats.com/fight-details/[^']+)'", onclick_attr)
            if match: fight_detail_link = match.group(1)
        if fight_detail_link and str_parts and len(str_parts) > 1:
            fight_stats = get_fight_details(fight_detail_link, name1, name2, str_parts[0], str_parts[1])
            head_strikes = fight_stats["head"]
            body_strikes = fight_stats["body"]
            leg_strikes = fight_stats["leg"]
            time.sleep(1)

        fighter1 = {
            'Fight_ID': row_index + 1,
            'Fighter': name1,
            'W/L': wl1,
            'Kd': kd1,
            'Str': str1,
            'Td': td1,
            'Sub': sub1,
            'Head': head_strikes["fighter1"],
            'Body': body_strikes["fighter1"],
            'Leg': leg_strikes["fighter1"],
            'Weight class': weight,
            'Method': method,
            'Round': round_num,
            'Time': time_str,
            'Total Damage': 0  # Больше не считаем в парсере
        }
        fighter2 = {
            'Fight_ID': row_index + 1,
            'Fighter': name2,
            'W/L': wl2,
            'Kd': kd2,
            'Str': str2,
            'Td': td2,
            'Sub': sub2,
            'Head': head_strikes["fighter2"],
            'Body': body_strikes["fighter2"],
            'Leg': leg_strikes["fighter2"],
            'Weight class': weight,
            'Method': method,
            'Round': round_num,
            'Time': time_str,
            'Total Damage': 0  # Больше не считаем в парсере
        }

        all_fighters.append(fighter1)
        all_fighters.append(fighter2)
        print(f"  {name1} vs {name2} ({weight}) | {wl1}/{wl2}")

    return pd.DataFrame(all_fighters), event_name

def clean_text(text): return re.sub(r'\s+', ' ', text).strip()

def get_event_name(soup):
    try:
        event_title = soup.find('h2', class_='b-content__title')
        if not event_title: event_title = soup.find('h1')
        if not event_title: event_title = soup.find('title')
        if event_title:
            title_text = event_title.get_text().strip()
            title_text = re.sub(r'[\\/*?:"<>|]', '_', title_text)
            title_text = re.sub(r'\s+', ' ', title_text).strip()
            return title_text
    except: pass
    return f"event_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

def get_all_fighters():
    print("📥 Загружаю полный список всех бойцов...")
    all_fighters = set()
    base_url = "http://www.ufcstats.com/statistics/fighters?char={}&page=all"
    for letter in [chr(i) for i in range(ord('a'), ord('z')+1)]:
        try:
            response = requests.get(base_url.format(letter))
            soup = BeautifulSoup(response.text, 'html.parser')
            table = soup.find('table')
            if not table: continue
            rows = table.find_all('tr')[1:]
            for row in rows:
                cols = row.find_all('td')
                if len(cols) >= 2:
                    first = clean_text(cols[0].get_text())
                    last = clean_text(cols[1].get_text())
                    if first and last and first not in ["--", ""] and last not in ["--", ""]:
                        all_fighters.add(f"{first} {last}")
        except: continue
    fighters_list = sorted(list(all_fighters), key=len, reverse=True)
    print(f"✅ Загружено {len(fighters_list)} уникальных полных имен бойцов")
    return fighters_list

def extract_fighter_names(text, fighters_list):
    text = clean_text(text)
    found_fighters = []
    remaining_text = text
    for fighter in sorted(fighters_list, key=len, reverse=True):
        if fighter in remaining_text:
            found_fighters.append(fighter)
            remaining_text = remaining_text.replace(fighter, " ")
    if len(found_fighters) >= 2:
        pos1 = text.find(found_fighters[0]); pos2 = text.find(found_fighters[1])
        return (found_fighters[0], found_fighters[1]) if pos1 < pos2 else (found_fighters[1], found_fighters[0])
    elif len(found_fighters) == 1:
        name1 = found_fighters[0]
        rest = text.replace(name1, " ").strip()
        for fighter in sorted(fighters_list, key=len, reverse=True):
            if fighter in rest and fighter != name1:
                pos1 = text.find(name1); pos2 = text.find(fighter)
                return (name1, fighter) if pos1 < pos2 else (fighter, name1)
        rest_parts = rest.split()
        if rest_parts:
            possible_name2 = " ".join(rest_parts)
            pos1 = text.find(name1); pos2 = text.find(possible_name2)
            return (name1, possible_name2) if pos1 < pos2 else (possible_name2, name1)
    return "", ""

def get_fight_details(fight_url, fighter1_name, fighter2_name, str_fighter1, str_fighter2):
    try:
        response = requests.get(fight_url)
        soup = BeautifulSoup(response.text, 'html.parser')
        head = {"fighter1": "0", "fighter2": "0"}
        body = {"fighter1": "0", "fighter2": "0"}
        leg = {"fighter1": "0", "fighter2": "0"}
        sections = soup.find_all('section', class_='b-fight-details__section')
        for section in sections:
            p_tag = section.find('p')
            if p_tag and 'Significant Strikes' in p_tag.get_text():
                table = section.find('table')
                if not table: table = section.find_next('table')
                if table:
                    rows = table.find_all('tr')
                    for row in rows:
                        cols = row.find_all('td')
                        if len(cols) > 0 and len(cols) >= 6:
                            first_col = cols[0]
                            name_ps = first_col.find_all('p')
                            if len(name_ps) >= 2:
                                head_ps = cols[3].find_all('p')
                                body_ps = cols[4].find_all('p')
                                leg_ps = cols[5].find_all('p')
                                if len(head_ps) >= 2 and len(body_ps) >= 2 and len(leg_ps) >= 2:
                                    head1 = head_ps[0].get_text().split('of')[0].strip()
                                    head2 = head_ps[1].get_text().split('of')[0].strip()
                                    body1 = body_ps[0].get_text().split('of')[0].strip()
                                    body2 = body_ps[1].get_text().split('of')[0].strip()
                                    leg1 = leg_ps[0].get_text().split('of')[0].strip()
                                    leg2 = leg_ps[1].get_text().split('of')[0].strip()
                                    sum1 = float(head1)+float(body1)+float(leg1)
                                    sum2 = float(head2)+float(body2)+float(leg2)
                                    exp1 = float(str_fighter1) if str_fighter1 else 0
                                    exp2 = float(str_fighter2) if str_fighter2 else 0
                                    if abs(sum1-exp1) <= 2 and abs(sum2-exp2) <= 2:
                                        head = {"fighter1": head1, "fighter2": head2}
                                        body = {"fighter1": body1, "fighter2": body2}
                                        leg = {"fighter1": leg1, "fighter2": leg2}
                                    elif abs(sum1-exp2) <= 2 and abs(sum2-exp1) <= 2:
                                        head = {"fighter1": head2, "fighter2": head1}
                                        body = {"fighter1": body2, "fighter2": body1}
                                        leg = {"fighter1": leg2, "fighter2": leg1}
                                break
        return {"head": head, "body": body, "leg": leg}
    except: return {"head": {"fighter1":"0","fighter2":"0"}, "body": {"fighter1":"0","fighter2":"0"}, "leg": {"fighter1":"0","fighter2":"0"}}

def save_to_yadisk(df, filename):
    filepath = os.path.join(tempfile.gettempdir(), filename)
    if os.path.exists(filepath): os.remove(filepath)
    df.to_excel(filepath, index=False)
    try:
        y = yadisk.YaDisk(token=YA_TOKEN)
        if not y.check_token(): return False
        y.upload(filepath, f"app:/{filename}", overwrite=True)
        print(f"✅ Файл {filename} загружен на Яндекс.Диск")
        return True
    except Exception as e:
        print(f"⚠️ Ошибка загрузки на Диск: {e}")
        return False

def sync_to_backend(tournament_name, tournament_date, league, fighters_df, is_completed):
    payload = {
        "tournament": {
            "name": tournament_name,
            "league": league,
            "date": tournament_date.strftime("%Y-%m-%d") if tournament_date else datetime.now().strftime("%Y-%m-%d")
        },
        "fighters": fighters_df.to_dict(orient='records'),
        "is_completed": is_completed
    }
    try:
        response = requests.post(BACKEND_URL, json=payload, timeout=30)
        if response.status_code == 200:
            print("✅ Данные успешно отправлены в бэкенд")
            
            # После успешной синхронизации — отправляем сигнал на пересчёт урона
            data = response.json()
            # Получаем ID турнира из ответа сервера (если есть) или ищем по имени
            recalc_response = requests.post(f"{RECALCULATE_URL}/recalculate", json={"tournament_name": tournament_name}, timeout=30)
            if recalc_response.status_code == 200:
                print("✅ Сигнал на пересчёт урона отправлен")
            else:
                print(f"⚠️ Ошибка при отправке сигнала на пересчёт: {recalc_response.status_code}")
            
            return True
        else:
            print(f"❌ Ошибка отправки в бэкенд: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"❌ Ошибка соединения с бэкендом: {e}")
        return False

def get_filename(event_name, event_date=None, is_upcoming=False):
    clean_name = re.sub(r'[\\/*?:"<>|]', '_', event_name)
    clean_name = re.sub(r'\s+', ' ', clean_name).strip().replace(' ', '_')
    if event_date:
        date_str = event_date.strftime('%B_%d_%Y')
        clean_name = f"{clean_name}_{date_str}"
    return f"UPCOMING_{clean_name}.xlsx" if is_upcoming else f"{clean_name}.xlsx"

def delete_upcoming_file_if_exists(tournament_name, event_date):
    try:
        y = yadisk.YaDisk(token=YA_TOKEN)
        clean_name = re.sub(r'[\\/*?:"<>|]', '_', tournament_name)
        clean_name = re.sub(r'\s+', ' ', clean_name).strip().replace(' ', '_')
        date_str = event_date.strftime('%B_%d_%Y') if event_date else ''
        upcoming_filename = f"UPCOMING_{clean_name}_{date_str}.xlsx" if date_str else f"UPCOMING_{clean_name}.xlsx"
        if y.exists(f"app:/{upcoming_filename}"):
            y.remove(f"app:/{upcoming_filename}", permanently=True)
            print(f"🗑️ Удалён UPCOMING файл: {upcoming_filename}")
    except Exception as e: print(f"⚠️ Ошибка при удалении UPCOMING файла: {e}")

def cleanup_old_past_tournaments(current_name, current_date):
    try:
        y = yadisk.YaDisk(token=YA_TOKEN)
        files = y.listdir("app:/")
        clean_current = re.sub(r'[\\/*?:"<>|]', '_', current_name)
        clean_current = re.sub(r'\s+', ' ', clean_current).strip().replace(' ', '_')
        current_date_str = current_date.strftime('%B_%d_%Y')
        for file in files:
            if file['type'] == 'file' and file['name'].endswith('.xlsx') and not file['name'].startswith('UPCOMING_'):
                if clean_current in file['name'] and current_date_str not in file['name']:
                    y.remove(f"app:/{file['name']}", permanently=True)
                    print(f"🗑️ Удалён старый файл: {file['name']}")
    except Exception as e: print(f"⚠️ Ошибка при очистке старых турниров: {e}")

def recalculate_tournament_damage(tournament_id):
    """Отправляет сигнал серверу на пересчёт урона для турнира"""
    try:
        response = requests.post(f"{RECALCULATE_URL}/{tournament_id}/recalculate", timeout=30)
        if response.status_code == 200:
            print(f"🔄 Пересчёт урона для турнира {tournament_id} выполнен")
            return True
        else:
            print(f"⚠️ Ошибка пересчёта: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"❌ Ошибка соединения при пересчёте: {e}")
        return False

# ========== ОСНОВНАЯ ПРОГРАММА ==========
print("🚀 Запуск парсера версии 2.0 (расчёт урона на сервере)...")
fighters_master_list = get_all_fighters()
if not fighters_master_list: exit()

prev_event, last_event = get_upcoming_and_last_events()
if not prev_event and not last_event:
    print("❌ Не найдено турниров для обработки")
    exit()

processed_urls = set()

def process_event(event):
    if event['url'] in processed_urls: return
    processed_urls.add(event['url'])
    print("\n" + "=" * 60)
    print(f"ОБРАБОТКА ТУРНИРА: {event['name']}")
    print("=" * 60)
    try:
        df, name = parse_tournament(event['url'], fighters_master_list)
        if df is not None and not df.empty:
            league = 'UFC'
            completed = is_tournament_complete(df)
            if completed:
                print("✅ ТУРНИР ЗАВЕРШЕН! Синхронизация с бэкендом.")
                sync_to_backend(name, event['date'], league, df, True)
                filename = get_filename(name, event['date'], is_upcoming=False)
                save_to_yadisk(df, filename)
                delete_upcoming_file_if_exists(name, event['date'])
                cleanup_old_past_tournaments(name, event['date'])
            else:
                print("⚠️ НЕ ВСЕ БОИ ЗАВЕРШЕНЫ. Синхронизация как upcoming.")
                sync_to_backend(name, event['date'], league, df, False)
                filename = get_filename(name, event['date'], is_upcoming=True)
                save_to_yadisk(df, filename)
    except Exception as e:
        print(f"❌ Ошибка: {e}")

if prev_event: process_event(prev_event)
if last_event: process_event(last_event)

print("\n✅ Парсинг завершен!")