# Compensation test controls

These five FCS 2.0 files are the compact compensation-control set distributed with the Bioconductor `flowCore` package. Each file contains roughly 7,500–10,000 events and seven parameters, including `FSC-H`, `SSC-H`, `FL1-H`, `FL2-H`, `FL3-H`, and `FL4-H`.

| File | Control |
| --- | --- |
| `unstained.fcs` | Unstained |
| `FL1-H_single_stain.fcs` | FL1-H single stain |
| `FL2-H_single_stain.fcs` | FL2-H single stain |
| `FL3-H_single_stain.fcs` | FL3-H single stain |
| `FL4-H_single_stain.fcs` | FL4-H single stain |

To exercise Cytofeather's manual compensation editor, load the five files together, open **Compensation** in the Data panel, and select the four `FL*-H` channels. The files are single-stain controls suitable for inspecting spill into the other detectors and refining the off-diagonal percentages.

Source: [`RGLab/flowCore`, `inst/extdata/compdata/data`](https://github.com/RGLab/flowCore/tree/devel/inst/extdata/compdata/data). The control-to-file mapping is documented in the package's [`HowTo-flowCore` vignette](https://github.com/RGLab/flowCore/blob/devel/vignettes/HowTo-flowCore.Rnw). The source package is licensed under Artistic-2.0; these files retain that provenance and are not covered by Cytofeather's MIT license.
