import common from "./common.json";
import environment from "./environment.json";
import errors from "./errors.json";
import navigation from "./navigation.json";
import request from "./request.json";
import response from "./response.json";
import settings from "./settings.json";
import shortcuts from "./shortcuts.json";
import tooltips from "./tooltips.json";

const fr = {
  common,
  environment,
  errors,
  navigation,
  request,
  response,
  settings,
  shortcuts,
  tooltips,
} as const;

export default fr;
