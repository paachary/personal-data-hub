import Link from "next/link";
import styles from "./AuthFooter.module.css";

export default function AuthFooter({ message, linkText, linkHref }) {
    return (
        <p className={styles.footer}>
            {message}{" "}
            <Link href={linkHref} className={styles.link}>
                {linkText}
            </Link>
        </p>
    );
}
