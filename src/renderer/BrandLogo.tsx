// Displays jinav's canonical supplied logo without replacing installed-app artwork.
import logo from "../../resources/jinav-logo.svg";
export function BrandLogo() {
  return <img className="brand-logo" src={logo} alt="" />;
}
