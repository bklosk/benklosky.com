import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";

type WithChildren = { children?: ReactNode; href?: string };

/**
 * Keeps intro text in the bubble blend, and gives each link a separate
 * underline that is not blended with the page.
 */
export function Ink({ children }: { children: ReactNode }) {
  return Children.map(children, (child) => {
    if (typeof child === "string" || typeof child === "number") {
      if (typeof child === "string" && child.trim() === "") return child;
      return <span className="ink">{child}</span>;
    }

    if (!isValidElement<WithChildren>(child)) return child;

    if (typeof child.props.href === "string") {
      return cloneElement(
        child as ReactElement<WithChildren>,
        undefined,
        <span className="ink">{child.props.children}</span>,
        <span className="link-rule" aria-hidden="true">
          {child.props.children}
        </span>,
      );
    }

    if (child.props.children != null) {
      return cloneElement(child, undefined, <Ink>{child.props.children}</Ink>);
    }

    return child;
  });
}
