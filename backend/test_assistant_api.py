import os
import sqlite3
import sys
import unittest
from datetime import date, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from backend.utils.assistant import query_casting_assistant


class AssistantQueryTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(':memory:')
        self.db.row_factory = sqlite3.Row
        self.db.executescript(
            '''
            CREATE TABLE castings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source TEXT,
                source_detail TEXT,
                client_name TEXT,
                client_company TEXT,
                client_contact TEXT,
                project_name TEXT,
                project_type TEXT,
                shoot_date_start TEXT,
                shoot_date_end TEXT,
                location TEXT,
                medium TEXT,
                usage TEXT,
                budget_min REAL,
                budget_max REAL,
                requirements TEXT,
                apply_to TEXT,
                status TEXT,
                priority TEXT,
                custom_fields TEXT,
                created_at TEXT,
                updated_at TEXT
            );
            CREATE TABLE team_members (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL
            );
            CREATE TABLE casting_assignments (
                casting_id INTEGER,
                team_member_id INTEGER
            );
            '''
        )

        today = date.today()
        this_week = today + timedelta(days=1)
        overdue = today - timedelta(days=2)

        self.db.executemany(
            '''
            INSERT INTO castings (
                id, client_name, client_company, project_name, shoot_date_start, shoot_date_end,
                location, medium, requirements, budget_min, budget_max, status, priority,
                custom_fields, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '{}', datetime('now'), datetime('now'))
            ''',
            [
                (1, 'Nike', 'Nike', 'Nike Summer', today.isoformat(), today.isoformat(), 'Mumbai', 'Digital', 'Street cast', 1000, 2000, 'IN_PROGRESS', 'HIGH'),
                (2, 'Adidas', 'Adidas', 'Adidas Delay', overdue.isoformat(), overdue.isoformat(), 'Delhi', 'Print', 'Runners', 900, 1500, 'CONFIRMED', 'NORMAL'),
                (3, 'Puma', 'Puma', 'Puma Weekly', this_week.isoformat(), this_week.isoformat(), 'Goa', 'TV', 'Athletes', 2000, 3000, 'PROPOSED', 'NORMAL'),
            ],
        )
        self.db.execute("INSERT INTO team_members (id, name) VALUES (1, 'Ava')")
        self.db.execute("INSERT INTO team_members (id, name) VALUES (2, 'Rohan')")
        self.db.execute('INSERT INTO casting_assignments (casting_id, team_member_id) VALUES (1, 1)')
        self.db.execute('INSERT INTO casting_assignments (casting_id, team_member_id) VALUES (3, 2)')
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def test_pending_today_query(self):
        response = query_casting_assistant(self.db, 'How many castings are pending today?')
        self.assertEqual(response['intent'], 'pending_today')
        self.assertEqual(response['totals']['count'], 1)
        self.assertIn('scheduled for today', response['answer'])

    def test_delayed_query(self):
        response = query_casting_assistant(self.db, 'Show delayed castings')
        self.assertEqual(response['intent'], 'delayed_castings')
        self.assertEqual(response['totals']['count'], 1)
        self.assertEqual(response['cards'][0]['title'], 'Adidas Delay')

    def test_weekly_assignments_query(self):
        response = query_casting_assistant(self.db, "What are this week's assignments?")
        self.assertEqual(response['intent'], 'weekly_assignments')
        self.assertGreaterEqual(response['totals']['castings'], 2)
        self.assertTrue(any(card['title'] == 'Ava' for card in response['cards']))

    def test_casting_lookup_query(self):
        response = query_casting_assistant(self.db, 'Find casting details for Nike Summer')
        self.assertEqual(response['intent'], 'casting_lookup')
        self.assertEqual(response['totals']['top_match_id'], 1)
        self.assertIn('Nike Summer', response['answer'])


if __name__ == '__main__':
    unittest.main()
