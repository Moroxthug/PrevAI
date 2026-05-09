{pkgs}: {
  deps = [
    pkgs.libgbm
    pkgs.libGL
    pkgs.systemd
    pkgs.cairo
    pkgs.pango
    pkgs.expat
    pkgs.alsa-lib
    pkgs.libxkbcommon
    pkgs.xorg.libxcb
    pkgs.xorg.libXrandr
    pkgs.xorg.libXfixes
    pkgs.xorg.libXext
    pkgs.xorg.libXdamage
    pkgs.xorg.libXcomposite
    pkgs.xorg.libX11
    pkgs.mesa
    pkgs.libdrm
    pkgs.cups
    pkgs.at-spi2-atk
    pkgs.atk
    pkgs.dbus
    pkgs.nspr
    pkgs.nss
    pkgs.glib
  ];
}
