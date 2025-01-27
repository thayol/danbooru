import Dropzone from 'dropzone';
import Utility from "./utility";
import capitalize from "lodash/capitalize";

export default class FileUploadComponent {
  static POLL_DELAY = 250;

  static initialize() {
    $(".file-upload-component").toArray().forEach(element => {
      new FileUploadComponent($(element));
    });
  }

  constructor($component) {
    this.$component = $component;
    this.$component.on("ajax:success", e => this.onSubmit(e));
    this.$component.on("ajax:error", e => this.onError(e));
    this.$dropTarget.on("paste.danbooru", e => this.onPaste(e));
    this.dropzone = this.initializeDropzone();

    // If the source field is pre-filled, then immediately submit the upload.
    if (/^https?:\/\//.test(this.$sourceField.val())) {
      this.$component.find("input[type='submit']").click();
    }
  }

  initializeDropzone() {
    if (!window.FileReader) {
      this.$dropzone.addClass("hidden");
      this.$component.find("input[type='file']").removeClass("hidden");
      return null;
    }

    let dropzone = new Dropzone(this.$dropTarget.get(0), {
      url: "/uploads.json",
      paramName: "upload[file]",
      clickable: this.$dropzone.get(0),
      previewsContainer: this.$dropzone.get(0),
      thumbnailHeight: null,
      thumbnailWidth: null,
      addRemoveLinks: false,
      maxFiles: 1,
      maxFilesize: this.maxFileSize,
      maxThumbnailFilesize: this.maxFileSize,
      timeout: 0,
      acceptedFiles: "image/jpeg,image/png,image/gif,video/mp4,video/webm",
      previewTemplate: this.$component.find(".dropzone-preview-template").html(),
    });

    dropzone.on("complete", file => {
      this.$dropzone.find(".dz-progress").hide();
    });

    dropzone.on("addedfile", file => {
      this.$dropzone.removeClass("error");
      this.$dropzone.find(".dropzone-hint").hide();

      // Remove all files except the file just added.
      dropzone.files.forEach(f => {
        if (f !== file) {
          dropzone.removeFile(f);
        }
      });
    });

    dropzone.on("success", file => {
      this.$dropzone.addClass("success");
      let upload = JSON.parse(file.xhr.response)
      this.pollStatus(upload);
    });

    dropzone.on("error", (file, msg) => {
      this.$dropzone.addClass("error");
    });

    return dropzone;
  }

  onPaste(e) {
    let url = e.originalEvent.clipboardData.getData("text");
    this.$component.find("input[name='upload[source]']:not([disabled])").val(url);

    if (/^https?:\/\//.test(url)) {
      this.$component.find("input[type='submit']:not([disabled])").click();
    }

    e.preventDefault();
  }

  onSubmit(e) {
    let upload = e.originalEvent.detail[0];
    this.pollStatus(upload);
  }

  // Called after the upload is submitted via AJAX. Polls the upload until it
  // is complete, then redirects to the upload page.
  async pollStatus(upload) {
    this.$component.find("progress").removeClass("hidden");
    this.$component.find("input").attr("disabled", "disabled");

    while (upload.media_asset_count <= 1 && upload.status !== "completed" && upload.status !== "error") {
      await Utility.delay(FileUploadComponent.POLL_DELAY);
      upload = await $.get(`/uploads/${upload.id}.json`);
    }

    if (upload.status === "error") {
      this.$dropzone.removeClass("success");
      this.$component.find("progress").addClass("hidden");
      this.$component.find("input").removeAttr("disabled");

      Utility.error(`Upload failed: ${upload.error}.`);
    } else {
      let params = new URLSearchParams(window.location.search);
      let isBookmarklet = params.has("url");
      params.delete("url");
      params.delete("ref");

      let url = new URL(`/uploads/${upload.id}`, window.location.origin);
      url.search = params.toString();

      if (isBookmarklet) {
        window.location.replace(url);
      } else {
        window.location.assign(url);
      }
    }
  }

  // Called when creating the upload failed because of a validation error (normally, because the source URL was not a real URL).
  async onError(e) {
    let errors = e.originalEvent.detail[0].errors;
    let message = Object.keys(errors).map(attribute => {
      return errors[attribute].map(error => {
        if (attribute === "base") {
          return `${error}`;
        } else {
          return `${capitalize(attribute)} ${error}`;
        }
      });
    }).join("; ");

    Utility.error(message);
  }

  get $dropzone() {
    return this.$component.find(".dropzone-container");
  }

  get $sourceField() {
    return this.$component.find("input[name='upload[source]']");
  }

  get maxFileSize() {
    return Number(this.$component.attr("data-max-file-size")) / (1024 * 1024);
  }

  // The element to listen for drag and drop events and paste events. By default,
  // it's the `.file-upload-component` element. If `data-drop-target` is the `body`
  // element, then you can drop images or paste URLs anywhere on the page.
  get $dropTarget() {
    return $(this.$component.attr("data-drop-target") || this.$component);
  }
}

$(FileUploadComponent.initialize);
