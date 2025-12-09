Contents

1  OP-Z And Samples: A Comprehensive Guide

  1.1  Drum Samples
    1.1.1  OP-1 Drum Utility Caveats
    1.1.2  Importing to the OP-Z
    1.1.3  Import Caveats
  1.2  Synth Samples
    1.2.1  Synth Sample Caveats
    1.2.2  Importing to the OP-Z
    1.2.3  Import Caveats

OP-Z And Samples: A Comprehensive Guide
I'm writing this guide to get into all the details about samples and the OP-Z because there's a lot of vague information and misconceptions out there.

Current date is Dec 2018, current OP-Z firmware is 1.1.12.

There are two different kinds of samples: Drum samples (Tracks 1-4) and synth samples (Tracks 5-8). You cannot add drum samples to tracks 5-8 or synth samples to tracks 1-4.

Drum Samples
Drum samples are a special AIFF file: mono, 16bit, 44.1kHz and with proprietary markers that describe some settings as well as the start and end points of the individually triggered sounds inside the big, “consolidated” AIFF file. This is the same format that is used in the OP-1 but in contrast to the OP-1's suggested sample placement the OP-Z likes to have 25 samples of the same kind (kick, snare, hat, fx) in a single sample to place them on the corresponding track. The 2 voice polyphony on tracks 1-4 is a good reason to follow that format.

Each individual sound has to be less than 4 seconds long and the consolidated AIFF has to be less than 12 seconds long. There can be up to 25 individual sounds in one consolidated file.

Creating the consolidation and the special markers is best done with OP-1 Drum Utility as mentioned in the OP-Z guide.

OP-1 Drum Utility Caveats
OP-1 Drum Utility has some adjustments for the sounds, these are the things you can edit when using the symbols in the top row. All of this is ignored on the OP-Z.

Don't waste your time tuning your samples in OP-1 Drum Utility. Unlike the OP-1, the OP-Z doesn't have individual settings for each sound in the consolidated file, so it disregards all these settings completely.

Arguably the worst part of this is adjusting the volume. You'll have to make sure your source samples are leveled nicely, also in relation to the other samples on the OP-Z, you cannot adjust them later on.

Importing to the OP-Z
Mounting the OP-Z as a drive in content mode as described in the OP-Z guide will show you some folders including samplepacks. Inside of samplepacks, there is a folder for every track. Inside of every track's folder, there are folders from 1 to 10 corresponding to the slot on the black numbered keys for this track. You can only place one consolidated sample in each of this numbered folders and it can only be on tracks 1-kick through 4-fx for drum samples.

Some folders contain empty files starting with a tilde in the name like ~kicks.aiff. These are references to the internal samples. You can delete these files if you want to place custom samples there instead.

After ejecting the disk, the OP-Z should restart and have imported the new samples. If something went wrong, it usually writes some logging into the file import.log that can also be accessed via content mode. The manual states that samples that could not have been imported also end up in the folder rejected but that was never the case for me.

Import Caveats
The OP-Z only regards the filename of a sample to check if it should trigger an import. If you try to update a sample that is already loaded on the OP-Z, you will have to either


use a different name
or remove it, go through an import cycle and then place the new sample back
In both cases all references to the sample inside the OP-Z will be lost. Projects using the sample will not play the corresponding track at all and once you select the “new” updated sample, all previous parameters will be lost, as will any saved preset settings.

Synth Samples
Synth samples are using the “snapshot format” from the OP-1. This is a special AIFF file as well: mono, 16bit, 44.1kHz. There are also some proprietary markers and the sample has to be exactly 6 seconds long.

At first glance the format looks very similar to the drum samples but the markers are different and the 6 second length is different as well.

To create this kind of file you can either use an OP-1 or create a mono 16bit 44.1kHz AIFF file with a length of exactly 6 seconds and add the markers through my OP-Z synth sample hack tool. You should make sure to have your sample fit to the musical key of A because the tool adds a base frequency of 440 Hz, so your sample will be mapped to the correct notes.

Synth Sample Caveats
There are several settings inside the markers that will control the settings on the OP-1. All of these will be ignored by the OP-Z with the exception of the base frequency which is used to place the pitching of the sample across the keys.

The most important ignored setting is the ADSR envelope. After importing, the envelope will be very short and will have to be adjusted on the OP-Z using the green parameter page. You'd probably want to save the “corrected” envelope to preset 1 by holding track and the lowest “white key”.

Other ignored settings:


Effects. There is only one effect and it will always be bitcrusher on synth parameter 1

LFO settings
The name of the sample/snapshot; it will be displayed in the app according to the file name.
If your sample is shorter than 6 seconds, it will be imported fine and will play back on the device, but there will be something I always describe as “sample bleed”: When your custom sample is done playing, something else will be played until the 6 seconds are reached. For me this have always been some drum samples but since this is probably a buffer overflow, it could end up being very harsh noises. Please make sure your samples are 6 seconds long!

Importing to the OP-Z
Importing synth samples is pretty much exactly like importing drum samples.

Mounting the OP-Z as a drive in content mode as per the OP-Z guide will show you some folders including samplepacks. Inside of samplepacks, there is a folder for every track. Inside of every track's folder, there are folders from 1 to 10 corresponding to the slot on the black numbered keys for this track. You can only place one synth sample in each of this numbered folders and it can only be on tracks 5-lead through 8-chords for synth samples.

Some folders contain empty files starting with a tilde in the name like ~buzz.engine. These are references to the internal synth engines. You can delete these files if you want to place custom samples there instead.

After ejecting the disk, the OP-Z should restart and have imported the new samples. If something went wrong, it usually writes some logging into the file import.log that can also be accessed via content mode. The manual states that samples which could not have been imported also end up in the folder rejected, but that was never the case for me.

Import Caveats
Same as drum samples. The OP-Z only regards the filename of a sample to check if it should trigger an import. If you try to update a sample that is already loaded on the OP-Z, you will have to either


use a different name
or remove it, go through an import cycle and then place the new sample back
In both cases all references to the sample inside the OP-Z will be lost. Projects using the sample will not play the corresponding track at all and once you select the “new” updated sample, all previous parameters will be lost, as will any saved preset settings.