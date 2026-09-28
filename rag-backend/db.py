import mysql.connector
from config import MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE

def get_connection():
    return mysql.connector.connect(
        host=MYSQL_HOST,
        user=MYSQL_USER,
        password=MYSQL_PASSWORD,
        database=MYSQL_DATABASE,
    )

def ensure_tables():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id         INT AUTO_INCREMENT PRIMARY KEY,
            username   VARCHAR(255) UNIQUE NOT NULL,
            password   VARCHAR(255) NOT NULL,
            role       ENUM('admin','user') NOT NULL DEFAULT 'user',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS qa_logs (
            id         INT AUTO_INCREMENT PRIMARY KEY,
            question   TEXT      NOT NULL,
            answer     TEXT      NOT NULL,
            user_id    INT       DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS document_registry (
            id          INT AUTO_INCREMENT PRIMARY KEY,
            filename    VARCHAR(512)  NOT NULL,
            file_path   VARCHAR(1024) NOT NULL,
            session_id  VARCHAR(64)   NOT NULL,
            user_id     INT           NOT NULL,
            uploaded_at TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
            status      VARCHAR(32)   DEFAULT 'uploaded',
            UNIQUE KEY uq_user_file (filename(255), user_id)
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS chat_sessions (
            session_id    VARCHAR(64)  PRIMARY KEY,
            document_name VARCHAR(512) NOT NULL,
            user_id       INT          NOT NULL,
            title         VARCHAR(200) DEFAULT 'New Chat',
            created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
            updated_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
                                       ON UPDATE CURRENT_TIMESTAMP
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS chat_messages (
            id           INT AUTO_INCREMENT PRIMARY KEY,
            session_id   VARCHAR(64) NOT NULL,
            role         VARCHAR(16) NOT NULL,
            content      TEXT        NOT NULL,
            sources      TEXT        DEFAULT NULL,
            is_favourite TINYINT(1)  DEFAULT 0,
            confidence_score FLOAT      DEFAULT NULL,
            created_at   TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (session_id)
                REFERENCES chat_sessions(session_id)
                ON DELETE CASCADE
        )
    """)

    # User activity log — tracks uploads, chats, ingestions with response times and confidence
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_activity_log (
            id              INT AUTO_INCREMENT PRIMARY KEY,
            user_id         INT           NOT NULL,
            action_type     VARCHAR(32)   NOT NULL,
            document_name   VARCHAR(512)  DEFAULT NULL,
            session_id      VARCHAR(64)   DEFAULT NULL,
            detail          TEXT          DEFAULT NULL,
            response_time_ms INT          DEFAULT NULL,
            created_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_user_activity (user_id, created_at)
        )
    """)

    # ── Migrations: safely add missing columns ─────────────────────────────────
    migrations = [
    ("qa_logs", "user_id",
     "ALTER TABLE qa_logs ADD COLUMN user_id INT DEFAULT NULL"),
    ("users", "created_at",
     "ALTER TABLE users ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"),
    ("users", "email",
     "ALTER TABLE users ADD COLUMN email VARCHAR(255) DEFAULT NULL"),
]
    
    for table, column, sql in migrations:
        cursor.execute("""
            SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME   = %s
              AND COLUMN_NAME  = %s
        """, (table, column))
        (exists,) = cursor.fetchone()
        if not exists:
            print(f"[Migration] Adding column '{column}' to table '{table}'")
            cursor.execute(sql)

    conn.commit()
    cursor.close()
    conn.close()
    print("Database tables verified / created")


def log_activity(user_id: int, action_type: str, document_name: str = None,
                 session_id: str = None, detail: str = None,
                 response_time_ms: int = None, confidence_score: float = None):
    """
    Record a user action. Never raises — logging failure never breaks the main flow.
    action_type values: 'upload' | 'ingest' | 'chat' | 'download' | 'delete'
    """
    try:
        conn = get_connection()
        try:
            cur = conn.cursor()
            cur.execute(
                """INSERT INTO user_activity_log
                   (user_id, action_type, document_name, session_id, detail, response_time_ms, confidence_score)
                   VALUES (%s, %s, %s, %s, %s, %s, %s)""",
                (user_id, action_type, document_name, session_id, detail, response_time_ms, confidence_score)
            )
            conn.commit()
            cur.close()
        finally:
            conn.close()
    except Exception as e:
        print(f"[activity_log] Failed to write: {e}")