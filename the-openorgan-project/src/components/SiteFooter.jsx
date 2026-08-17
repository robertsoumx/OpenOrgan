export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <p>© {new Date().getFullYear()} The OpenOrgan Project · openorgan.org</p>
      </div>
    </footer>
  );
}
