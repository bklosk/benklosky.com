declare module "glightbox" {
  interface GLightboxOptions {
    selector?: string;
    loop?: boolean;
    openEffect?: string;
    closeEffect?: string;
    slideEffect?: string;
    moreText?: string;
    moreLength?: number;
    closeButton?: boolean;
    touchNavigation?: boolean;
    keyboardNavigation?: boolean;
    closeOnOutsideClick?: boolean;
    onOpen?: () => void;
    onClose?: () => void;
  }

  class GLightbox {
    constructor(options?: GLightboxOptions);
    destroy(): void;
    open(index?: number): void;
    close(): void;
    next(): void;
    prev(): void;
  }

  export default GLightbox;
}
