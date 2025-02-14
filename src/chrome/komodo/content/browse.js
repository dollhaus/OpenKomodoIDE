/* Copyright (c) 2000-2006 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */

/*
 * This file contains the functions that launch browsers for e.g.
 * the language reference pages.
 *
 * A utility function ko.browse.openUrlInDefaultBrowser(url)
 * is also provided, which can be used from elsewhere in Komodo.
 */

if (typeof(ko)=='undefined') {
    var ko = {};
}

ko.browse = {};
(function() {

var {logging} = Components.utils.import("chrome://komodo/content/library/logging.js", {});
var log = logging.getLogger("browse");
var bundle = Components.classes["@mozilla.org/intl/stringbundle;1"]
        .getService(Components.interfaces.nsIStringBundleService)
        .createBundle("chrome://komodo/locale/browse.properties");
/**
 * open the given url or complain appropriately
 *
 * @param {String} url
 * @param {String} browser optional, retreived from prefs if not used
 */
this.openUrlInDefaultBrowser = function browse_OpenUrlInDefaultBrowser(url, browser) {
    var koWebbrowser = Components.classes['@activestate.com/koWebbrowser;1'].
                       getService(Components.interfaces.koIWebbrowser);
    var prefs = Components.classes['@activestate.com/koPrefService;1'].
            getService(Components.interfaces.koIPrefService).prefs;

    if (typeof(browser) == 'undefined' || !browser) {
        browser = prefs.getStringPref('browser');
    }
    var infoService = Components.classes['@activestate.com/koInfoService;1'].
                      getService(Components.interfaces.koIInfoService);
    var platform = infoService.platform;
    if (!platform.match(/^win/) && !platform.match(/^darwin/)
        && browser == '')
    {
        // Don't guess, since launching e.g. Mozilla can have side effects
        var browsers = koWebbrowser.get_possible_browsers(new Object());
        var answer = ko.dialogs.selectFromList(
                bundle.GetStringFromName("chooseDefaultBrowser.message"),
                bundle.GetStringFromName("selectTheBrowserToOpen.message"),
                browsers,
                "one"); // selectionCondition
        if (answer == null) {
            return;
        }
        prefs.setStringPref("browser", answer[0]);
        browser = answer[0];
    }
    var ret = false;
    try {
        if (browser) {
            ret = koWebbrowser.open_new_browser(url,browser);
        } else {
            ret = koWebbrowser.open_new(url);
        }
    } catch (e) {
        log.exception(e);
    }
    if (!ret) {
        if (browser) {
            ko.dialogs.alert(bundle.formatStringFromName(
                "couldNotOpenTheBrowserAt.alert", [browser], 1));
        } else {
            ko.dialogs.alert(bundle.formatStringFromName(
                "couldNotFindAGraphicalBrowser.alert", [url], 1));
        }
    }
}

/**
 * show a list of keybindings in the browser
 */
this.showKeybindings = function browse_ShowKeybindings()
{
    try {
        var text = ko.keybindings.manager.makeCurrentKeyBindingTable();
        var tmpFileSvc = Components.classes["@activestate.com/koFileService;1"]
                         .getService(Components.interfaces.koIFileService)
        var outputTmpFile = tmpFileSvc.makeTempFile(".html","w");
        //dump('outputTmpFile name is '+outputTmpFile.URI+'\n');
        outputTmpFile.puts(text);
        outputTmpFile.flush();
        outputTmpFile.close();
        ko.browse.openUrlInDefaultBrowser(outputTmpFile.URI);
    } catch(e) {
        log.exception(e);
    }
}

/**
 * show a list of command id's in the browser
 */
this.showCommandIds = function browse_ShowCommandIds()
{
    try {
        var text = ko.keybindings.manager.makeCommandIdTable();
        var tmpFileSvc = Components.classes["@activestate.com/koFileService;1"]
                         .getService(Components.interfaces.koIFileService)
        var outputTmpFile = tmpFileSvc.makeTempFile(".html","w");
        //dump('outputTmpFile name is '+outputTmpFile.URI+'\n');
        outputTmpFile.puts(text);
        outputTmpFile.flush();
        outputTmpFile.close();
        ko.browse.openUrlInDefaultBrowser(outputTmpFile.URI);
    } catch(e) {
        log.exception(e);
    }
}

/**
 * show the url defined in "webHelpURL" in an instance of koIAppInfoEx
 *
 * @param {String} app the app identifier from the CID of a koIAppInfoEx
 *                 implementation (eg. @activestate.com/koAppInfoEx?app=Perl)
 */
this.webHelp = function(app) {
    var info = Components.classes["@activestate.com/koAppInfoEx?app="+app+";1"]
                      .getService(Components.interfaces.koIAppInfoEx);
    ko.browse.openUrlInDefaultBrowser(info.webHelpURL);
}

/**
 * show mailing list archives on ASPN that are related to the topic
 *
 * @param {String} topic
 */
this.aspnMailingList = function(topic) {
    var url = "http://code.activestate.com/lists/#"+topic;
    ko.browse.openUrlInDefaultBrowser(url);
}

// About build info (copied from about.js).
function _getAboutBuildInfo() {
    var _bundle = Components.classes["@mozilla.org/intl/stringbundle;1"]
            .getService(Components.interfaces.nsIStringBundleService)
            .createBundle("chrome://komodo/locale/about.properties");
    var infoSvc = Components.classes["@activestate.com/koInfoService;1"].
                  getService(Components.interfaces.koIInfoService);
    var buildInfo = _bundle.formatStringFromName("aboutInfo.message",
            [infoSvc.prettyProductType,
             infoSvc.version,
             infoSvc.buildNumber,
             infoSvc.buildPlatform,
             infoSvc.buildASCTime], 5);
    var brandingPhrase = infoSvc.brandingPhrase;
    if (brandingPhrase) {
        buildInfo += "\n"+brandingPhrase;
    }
    return buildInfo;
}

/**
 * Return an object containing Bugzilla HTTP query fields.
 *
 * E.g. {"op_sys": "linux", "version": "123"}.
 */
function getKomodoBugzillaQueryParams() {
    // version      - the dumbed down Komodo version e.g. "8.0.2 IDE"
    // rep_platform - the platform architecture
    // op_sys       - the operating system
    // comment      - the description of the bug
    var infoSvc = Components.classes["@activestate.com/koInfoService;1"].
                  getService(Components.interfaces.koIInfoService);

    var version = infoSvc.version.split("-")[0];
    if (infoSvc.version.indexOf("-alpha") != -1) {
        version += " Alpha " + infoSvc.version.substr(-1);
    } else if (infoSvc.version.indexOf("-beta") != -1) {
        version += " Beta " + infoSvc.version.substr(-1);
    } else {
        version += " " + infoSvc.prettyProductType;
    }

    var rep_platform = "Any";
    var op_sys;
    if (infoSvc.platform.startsWith("win32")) {
        op_sys = "Windows (Any)";
    } else if (infoSvc.platform.startsWith("linux")) {
        op_sys = "Linux";
        if (infoSvc.buildPlatform.indexOf("64")) {
            rep_platform = "PC-64 bit";
        } else {
            rep_platform = "PC-32 bit";
        }
    } else if (infoSvc.platform == "darwin") {
        op_sys = "Mac OS X / X Server";
    }

    var comment = _getAboutBuildInfo() + "\n\n";

    return {
        "version": version,
        "rep_platform": rep_platform,
        "op_sys" : op_sys,
        "comment": comment,
    };
}

// XXX move these to a properties file or prefs.js
var tag2uri = {
    'mailLists': "https://code.activestate.com/lists/komodo-discuss/",
    'home': "https://www.activestate.com/komodo-ide",
    'aspn': "https://code.activestate.com/",
    'community': "http://community.komodoide.com/",
    'contactus': "https://www.activestate.com/company/contact-us",
    'bugs': "https://github.com/Komodo/KomodoEdit/issues",
    'packages': "http://community.komodoide.com/packages/",
    'contribute': "http://community.komodoide.com/packages/submit-instructions/#pane-packages"
};

/**
 * browse to a predefined url on activestate.com  see tag2uri in ko.browse
 */
this.browseTag = function(tag) {
    if (tag in tag2uri) {
        ko.browse.openUrlInDefaultBrowser(tag2uri[tag]);
    } else {
        require("notify/notify").send(
            "ko.browse.browseTag error: unknown tag '"+tag+"'", "browser",
            {priority: "error"}
        );
    }
}
}).apply(ko.browse);
