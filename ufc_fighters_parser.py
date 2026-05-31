# ufc_fighters_parser.py – оптимизированная версия с переиспользованием драйвера
import requests
from bs4 import BeautifulSoup
from datetime import datetime
import re
import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.chrome.service import Service

# Конфигурация
BACKEND_URL = "https://apf-app-backend.onrender.com"

# Глобальный драйвер (переиспользуется)
driver = None

def get_driver():
    """Возвращает существующий экземпляр драйвера или создаёт новый"""
    global driver
    if driver is None:
        print("🚀 Инициализация Chrome драйвера...")
        chrome_options = Options()
        chrome_options.add_argument("--headless=new")
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_options.add_argument("--disable-gpu")
        chrome_options.add_argument("--window-size=1920,1080")
        chrome_options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        
        service = Service(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=chrome_options)
        print("✅ Chrome драйвер готов")
    return driver

def close_driver():
    """Закрывает драйвер"""
    global driver
    if driver:
        print("🔚 Закрытие Chrome драйвера...")
        driver.quit()
        driver = None

def get_page_html(url, wait_for_selector=None, timeout=30):
    """Получает HTML страницы через переиспользуемый драйвер"""
    try:
        driver = get_driver()
        driver.get(url)
        
        # Ждём загрузки страницы
        time.sleep(3)
        
        if wait_for_selector:
            WebDriverWait(driver, timeout).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, wait_for_selector))
            )
        
        return driver.page_source
    except Exception as e:
        print(f"❌ Ошибка загрузки страницы {url}: {e}")
        # Пробуем пересоздать драйвер
        close_driver()
        raise

def clean_text(text):
    return re.sub(r'\s+', ' ', text).strip()

def get_all_fighters():
    """Парсит всех бойцов с ufcstats.com"""
    print("📥 Загружаю полный список всех бойцов...")
    all_fighters = []
    base_url = "http://www.ufcstats.com/statistics/fighters?char={}&page=all"
    
    for letter in [chr(i) for i in range(ord('a'), ord('z')+1)]:
        try:
            url = base_url.format(letter)
            print(f"  🔍 Загрузка буквы {letter}...")
            html = get_page_html(url, wait_for_selector="table")
            soup = BeautifulSoup(html, 'html.parser')
            table = soup.find('table')
            if not table:
                print(f"  ⚠️ Таблица не найдена для {letter}")
                continue
            
            rows = table.find_all('tr')[1:]
            letter_count = 0
            for row in rows:
                cols = row.find_all('td')
                if len(cols) >= 2:
                    first = clean_text(cols[0].get_text())
                    last = clean_text(cols[1].get_text())
                    if first and last and first not in ["--", ""] and last not in ["--", ""]:
                        full_name = f"{first} {last}"
                        all_fighters.append({
                            'first_name': first,
                            'last_name': last,
                            'full_name': full_name
                        })
                        letter_count += 1
            
            print(f"  ✅ Буква {letter}: загружено {letter_count} бойцов (всего: {len(all_fighters)})")
            time.sleep(0.5)  # Небольшая пауза между буквами
        except Exception as e:
            print(f"  ❌ Ошибка для буквы {letter}: {e}")
            continue
    
    return all_fighters

def sync_to_backend(fighters):
    """Отправляет список бойцов на бэкенд"""
    print(f"\n💾 Отправляю {len(fighters)} бойцов в бэкенд...")
    
    # Сначала очищаем таблицу
    try:
        response = requests.post(f"{BACKEND_URL}/api/ufc-fighters/clear", timeout=30)
        if response.status_code == 200:
            print("✅ Таблица очищена")
        else:
            print(f"⚠️ Ошибка очистки: {response.status_code}")
    except Exception as e:
        print(f"⚠️ Ошибка очистки: {e}")

    # Отправляем чанками по 500 бойцов
    chunk_size = 500
    total_chunks = (len(fighters) + chunk_size - 1) // chunk_size
    
    for i in range(0, len(fighters), chunk_size):
        chunk = fighters[i:i+chunk_size]
        chunk_num = i // chunk_size + 1
        try:
            response = requests.post(
                f"{BACKEND_URL}/api/ufc-fighters/sync",
                json={'fighters': chunk},
                timeout=60
            )
            if response.status_code == 200:
                print(f"  ✅ Партия {chunk_num}/{total_chunks} успешно загружена")
            else:
                print(f"  ❌ Ошибка: {response.status_code} - {response.text}")
                return False
        except Exception as e:
            print(f"  ❌ Ошибка соединения: {e}")
            return False
            

    return True

def get_fighters_count():
    """Проверяет, сколько бойцов уже есть в базе"""
    try:
        response = requests.get(f"{BACKEND_URL}/api/ufc-fighters/count", timeout=30)
        if response.status_code == 200:
            return response.json().get('count', 0)
    except:
        pass
    return 0

def main():
    print("🚀 Запуск оптимизированного парсера списка бойцов UFC")
    print("=" * 50)
    
    try:
        # Проверяем текущее количество
        current_count = get_fighters_count()
        print(f"📊 Текущее количество бойцов в базе: {current_count}")
        
        print("\n🌐 Начинаю парсинг с ufcstats.com...")
        fighters = get_all_fighters()
        
        if not fighters:
            print("❌ Не удалось загрузить бойцов")
            return
        
        print(f"\n✅ Загружено {len(fighters)} уникальных бойцов")
        
        # Отправляем в бэкенд
        if sync_to_backend(fighters):
            print(f"\n🎉 Готово! База обновлена: {len(fighters)} бойцов")
        else:
            print("\n❌ Ошибка при синхронизации с бэкендом")
    
    finally:
        # Всегда закрываем драйвер
        close_driver()

if __name__ == "__main__":
    main()