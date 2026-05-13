import styles from "./AdminRestrictedSection.module.css";

export default function AdminRestrictedSection({ section }) {
    return (
        <section className={styles.wrapper}>
            <div className={styles.icon}>🔒</div>
            <h2 className={styles.title}>{section}</h2>
            <p className={styles.message}>
                This section contains sensitive user data.
            </p>
            <p className={styles.hint}>
                To view {section.toLowerCase()}, please log in as the respective
                user.
            </p>
        </section>
    );
}
