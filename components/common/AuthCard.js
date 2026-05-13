import styles from "./AuthCard.module.css";

export default function AuthCard({
    title,
    subtitle,
    children,
    compact = false,
}) {
    return (
        <div className={styles.pageWrapper}>
            <div
                className={`${styles.card} ${
                    compact ? styles.cardCompact : ""
                }`}
            >
                <div className={styles.cardHeader}>
                    <h1 className={styles.title}>{title}</h1>
                    {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
                </div>
                <div className={styles.cardBody}>{children}</div>
            </div>
        </div>
    );
}
