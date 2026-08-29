import type {
  Config,
  FileUploaderRegular,
  UploadCtxProvider,
} from "@uploadcare/file-uploader";
import type * as React from "react";

type CustomElementProps<T extends HTMLElement> = React.DetailedHTMLProps<
  React.HTMLAttributes<T>,
  T
> & {
  class?: string;
};

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "uc-config": CustomElementProps<Config> & Config["attributesMeta"];
      "uc-file-uploader-regular": CustomElementProps<FileUploaderRegular> &
        FileUploaderRegular["attributesMeta"];
      "uc-upload-ctx-provider": CustomElementProps<UploadCtxProvider> &
        UploadCtxProvider["attributesMeta"];
    }
  }
}
