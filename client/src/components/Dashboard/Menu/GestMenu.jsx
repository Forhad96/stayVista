import MenuItem from "../Sidebar/MenuItem";
import { BsFingerprint } from "react-icons/bs";

const GuestMenu = () => {
  return (
    <>
      <MenuItem
        icon={BsFingerprint}
        label="My Bookings"
        address="my-bookings"
      />
    </>
  );
};

export default GuestMenu;
